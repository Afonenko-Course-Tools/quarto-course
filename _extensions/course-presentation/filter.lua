-- Фильтр выполняется после course-core на этапе pre-ast. Ядро отбирает данные
-- по профилю и проверяет их смысл; этот модуль оформляет их в штатных форматах.
local config = require("./modules/config")
local metadata = require("./modules/metadata")
local answers = require("./modules/answers")

local function transform(blocks, owner, cfg)
  return blocks:walk({traverse = "topdown", Div = function(div)
    local current = div.identifier:match("^exr%-") and div.identifier or owner
    local kind = answers.kind(div, owner)
    div.content = transform(div.content, current, cfg)
    div = metadata.decorate(div, cfg)
    return answers.wrap(div, kind, cfg), false
  end})
end

return {{Pandoc = function(doc)
  assert(not doc.meta.course or doc.meta["course-core-processed"] == true,
    "Фильтр course-core должен предшествовать course-presentation при наличии метаданных course")
  local cfg = config.read(doc.meta)
  doc.blocks = transform(doc.blocks, nil, cfg)
  if cfg.html then
    quarto.doc.add_html_dependency({name = "course-presentation", version = "0.1.0",
      stylesheets = {"presentation.css"}, scripts = {"disclosure.js", "presentation.js"}})
  end
  return doc
end}}
