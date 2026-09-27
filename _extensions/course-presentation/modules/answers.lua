-- Preserve the native #sol-* / callout node and its identifier. Only a new,
-- identifier-free parent controls disclosure, so native crossrefs keep working.
local M = {}
function M.kind(div, owner)
  local related = div.attributes["for"] or owner
  if not related then return nil end
  if div.identifier:match("^sol%-") or div.classes:includes("solution") then return "solution" end
  if div.classes:includes("callout-tip") and not div.attributes["course-role"] then return "hint" end
  return nil
end
function M.wrap(div, kind, cfg)
  if not kind then return div end
  local classes = {"course-answer", "course-answer-" .. kind}
  if not cfg.html or cfg.answers == "expanded" then
    return pandoc.Div({div}, pandoc.Attr("", classes))
  end
  if cfg.mode == "lecture" then
    if cfg.reveal then table.insert(classes, "fragment") end
    return pandoc.Div({div}, pandoc.Attr("", classes))
  end
  local summary = cfg.ru and (kind == "hint" and "Показать подсказку" or "Показать решение")
    or (kind == "hint" and "Show hint" or "Show solution")
  if not cfg.reveal then
    table.insert(classes, "callout-note")
    -- Quarto's own Bootstrap disclosure owns toggling and ARIA state.
    return pandoc.Div({pandoc.Header(3, summary), div}, pandoc.Attr("", classes,
      {collapse = "true", icon = "false"}))
  end
  -- Reveal does not implement native callout collapse. The renderer supplies a
  -- native <details> element; authors still write only Pandoc/Quarto Markdown.
  return pandoc.Div({pandoc.RawBlock("html", "<details><summary>" .. summary .. "</summary>"),
    div, pandoc.RawBlock("html", "</details>")}, pandoc.Attr("", classes))
end
return M
