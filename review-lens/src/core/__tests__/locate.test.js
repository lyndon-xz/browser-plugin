import { describe, expect, it } from "vitest";

import { locateInNewVersion } from "../locate.js";

/*
 * 真机上暴露过两次：先是沿用旧行号，右侧落到别的方法里；改成整行签名匹配后，
 * 参数类型一变又匹配不上、回退同行号，仍然展示了无关代码。所以这里锁住两件事：
 * 按方法名定位，以及定位不到时必须返回 null。
 */
const oldVersion = `package a;

public class Dao {
  private DalQueryDao dao;

  public List<Detail> getByIds(List<Long> ids) throws SQLException {
    String sql = "select * from t where id in (?)";
    DalHints hints = DalHints.createIfAbsent(null).timeout(60 * 3);
    return dao.query(sql, hints, ids);
  }
}`.split("\n");

// 方法整体下移 4 行、锚点行内容改了、而且参数类型也换了
const newVersion = `package a;

public class Dao {
  private DalQueryDao dao;

  public Dao() {
    this.dao = new DalQueryDao(DATA_BASE);
  }

  public List<Detail> getByIds(Collection<Long> ids) throws SQLException {
    String sql = "select * from t where id in (?)";
    DalHints hints = DalHints.createIfAbsent(null).timeout(30);
    return dao.query(sql, hints, ids);
  }
}`.split("\n");

describe("locateInNewVersion", () => {
  it("follows the method by name, even when the signature changed", () => {
    // 旧第 8 行是 timeout 那行（方法从第 6 行起）；新方法从第 10 行起
    const located = locateInNewVersion({ oldLines: oldVersion, newLines: newVersion, anchorLine: 8 });

    expect(located).toEqual({ anchorLine: 12 });
    expect(newVersion[located.anchorLine - 1]).toContain("timeout(30)");
  });

  it("gives up rather than pointing at unrelated code", () => {
    const renamed = newVersion.map((line) => line.replace("getByIds", "queryByIds"));

    expect(locateInNewVersion({ oldLines: oldVersion, newLines: renamed, anchorLine: 8 })).toBeNull();
  });

  it("gives up when the anchor is not inside any method", () => {
    expect(locateInNewVersion({ oldLines: oldVersion, newLines: newVersion, anchorLine: 1 })).toBeNull();
  });

  it("does not mistake a call site for the method itself", () => {
    const withCall = `package a;

public class Caller {
  void run() {
    dao.getByIds(ids);
  }

  public List<Detail> getByIds(Collection<Long> ids) throws SQLException {
    DalHints hints = DalHints.createIfAbsent(null).timeout(30);
    return dao.query(sql, hints, ids);
  }
}`.split("\n");

    const located = locateInNewVersion({ oldLines: oldVersion, newLines: withCall, anchorLine: 8 });

    // 第 5 行是调用点，方法起始在第 8 行
    expect(located.anchorLine).toBeGreaterThan(5);
  });

  it("clamps to the method body when the new method is shorter", () => {
    const shorter = `package a;

public class Dao {
  public List<Detail> getByIds(Collection<Long> ids) throws SQLException {
    return dao.query(sql, ids);
  }
}`.split("\n");

    const located = locateInNewVersion({ oldLines: oldVersion, newLines: shorter, anchorLine: 8 });

    expect(located.anchorLine).toBeLessThanOrEqual(6);
  });
});
