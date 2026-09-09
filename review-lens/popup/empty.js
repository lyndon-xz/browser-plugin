export function renderEmptyState(request) {
  const { title = "还没有卡片", detail } = request;

  const box = document.createElement("div");
  box.className = "empty";

  const rail = document.createElement("span");
  rail.className = "empty-rail";

  const heading = document.createElement("strong");
  heading.textContent = title;

  const body = document.createElement("p");
  body.textContent = detail;

  box.append(rail, heading, body);
  return box;
}
