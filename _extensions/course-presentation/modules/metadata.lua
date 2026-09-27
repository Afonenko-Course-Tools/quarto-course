-- Компактные подписи формируются из учебных атрибутов. В course.json
-- хранятся исходные значения, без созданных элементов оформления.
local M = {}
local roles = {
  demonstration = {"Демонстрация", "Demonstration"}, prediction = {"Прогноз", "Prediction"},
  discussion = {"Обсуждение", "Discussion"}, ["self-check"] = {"Самопроверка", "Self-check"},
  objectives = {"Цели", "Objectives"}, prerequisites = {"Предварительные знания", "Prerequisites"},
  reading = {"Материалы", "Reading"}, takeaway = {"Главное", "Takeaway"},
  limitation = {"Ограничение", "Limitation"}, misconception = {"Типичная ошибка", "Misconception"},
  criteria = {"Критерии", "Criteria"}, deliverables = {"Что сдавать", "Deliverables"}
}
local difficulty = {introductory = {"Начальный", "Introductory"}, intermediate = {"Средний", "Intermediate"}, advanced = {"Продвинутый", "Advanced"}}
local modes = {individual = {"Индивидуально", "Individual"}, pair = {"В паре", "Pair"}, group = {"В группе", "Group"}}
local requirement = {required = {"Обязательно", "Required"}, recommended = {"Рекомендуется", "Recommended"}, optional = {"Дополнительно", "Optional"}}
local activities = {demonstration = true, prediction = true, discussion = true, ["self-check"] = true}
local function label(pair, cfg) return pair and pair[cfg.ru and 1 or 2] end
local function add_class(div, name) if not div.classes:includes(name) then div.classes:insert(name) end end
function M.decorate(div, cfg)
  local attrs = div.attributes
  local role = attrs["course-role"]
  local defaults = (div.identifier:match("^exr%-") or activities[role]) and cfg.defaults or {}
  local values = {}
  for _, key in ipairs({"difficulty", "time", "work-mode", "requirement"}) do
    values[key] = attrs[key] or defaults[key]
  end
  local parts = pandoc.List()
  local function badge(text, kind)
    if not text then return end
    if #parts > 0 then parts:insert(pandoc.Space()) end
    parts:insert(pandoc.Span({pandoc.Str(text)}, pandoc.Attr("", {"course-meta", "course-meta-" .. kind})))
  end
  if roles[role] then
    add_class(div, "course-block")
    add_class(div, "course-role-" .. role)
    badge(label(roles[role], cfg), "role")
  end
  badge(label(difficulty[values.difficulty], cfg), "difficulty")
  badge(values.time and (values.time .. (cfg.ru and " мин" or " min")), "time")
  badge(label(modes[values["work-mode"]], cfg), "work-mode")
  badge(label(requirement[values.requirement], cfg), "requirement")
  if #parts > 0 then
    local line = pandoc.Div({pandoc.Plain(parts)}, pandoc.Attr("", {"course-metadata"}))
    -- Quarto читает название теоремы или упражнения из первого Header.
    -- Сохраняем его положение и единственный экземпляр ID.
    local position = div.content[1] and div.content[1].t == "Header" and 2 or 1
    div.content:insert(position, line)
  end
  -- Авторские атрибуты не должны совпадать с семантикой атрибутов браузера.
  -- Ядро уже извлекло и проверило их на этапе pre-ast.
  for _, key in ipairs({"course-role", "difficulty", "time", "work-mode", "requirement", "for"}) do
    if attrs[key] then attrs[key == "course-role" and "data-course-role" or "data-course-" .. key] = attrs[key]; attrs[key] = nil end
  end
  return div
end
return M
