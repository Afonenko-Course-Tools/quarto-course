-- Authoring vocabulary only. Rendering belongs to course-presentation.
local M = {}
M.roles = {demonstration=true, prediction=true, discussion=true, ["self-check"]=true,
  objectives=true, prerequisites=true, reading=true, takeaway=true, limitation=true,
  misconception=true, criteria=true, deliverables=true}
M.activities = {demonstration=true, prediction=true, discussion=true, ["self-check"]=true}
M.attributes = {["course-role"]=true, difficulty=true, time=true, ["work-mode"]=true,
  requirement=true, ["for"]=true}
local difficulties = {introductory=true, intermediate=true, advanced=true}
local modes = {individual=true, pair=true, group=true}
local requirements = {required=true, recommended=true, optional=true}

local function choice(value, values, name)
  if value ~= nil then assert(values[value], "Invalid pedagogy " .. name .. ": " .. tostring(value)) end
  return value
end

-- A time is an estimate in whole minutes, never an execution timer.
function M.metadata(values)
  local time = values.time
  if time ~= nil then
    assert(tostring(time):match("^[1-9][0-9]*$"), "Pedagogy time must be a positive integer in minutes")
    time = tonumber(time)
    assert(time <= 1000000, "Pedagogy time must not exceed 1000000 minutes")
  end
  return {difficulty=choice(values.difficulty, difficulties, "difficulty"), time=time,
    workMode=choice(values["work-mode"], modes, "work-mode"),
    requirement=choice(values.requirement, requirements, "requirement")}
end

-- Explicit opt-in preserves ordinary document metadata for unrelated projects.
-- Top-level fields stay usable by Quarto's native listings without duplication.
function M.defaults(meta)
  local config = meta["course-pedagogy"]
  if config == nil then return nil end
  assert(type(config) == "table", "course-pedagogy must be a metadata mapping")
  for key, _ in pairs(config) do
    assert(key == "document-defaults", "Unknown course-pedagogy option: " .. tostring(key))
  end
  local enabled = config["document-defaults"]
  assert(enabled == nil or type(enabled) == "boolean", "course-pedagogy.document-defaults must be boolean")
  if not enabled then return nil end
  local values = {}
  for _, key in ipairs({"difficulty", "time", "work-mode"}) do
    if meta[key] ~= nil then values[key] = pandoc.utils.stringify(meta[key]) end
  end
  return M.metadata(values)
end

function M.is_exercise(div) return div.identifier:match("^exr%-") ~= nil end
function M.kind(div, owner)
  local role = div.attributes["course-role"]
  if role then assert(M.roles[role], "Unknown course-role: " .. role) end
  if M.is_exercise(div) then
    assert(not role or M.activities[role], "An exr-* may only have an activity course-role")
    return role or "exercise"
  end
  local solution = div.identifier:match("^sol%-") or div.classes:includes("solution")
  -- A visual tip callout can also hold explicitly labelled reading/objectives;
  -- an author role takes precedence over this conventional hint inference.
  local hint = not role and div.classes:includes("callout-tip") and (div.attributes["for"] ~= nil or owner ~= nil)
  assert(not role or not solution, "A solution cannot also declare course-role")
  return role or (solution and "solution") or (hint and "hint") or nil
end

function M.describe(div, defaults, owner)
  local kind = M.kind(div, owner)
  local educational = M.is_exercise(div) or M.activities[kind]
  local values = {}
  for _, key in ipairs({"difficulty", "time", "work-mode"}) do
    local value = div.attributes[key]
    assert(value == nil or educational, key .. " requires an exr-* or activity course-role")
    values[key] = value
  end
  values.requirement = div.attributes.requirement
  assert(values.requirement == nil or kind == "reading", "requirement requires course-role=reading")
  assert(div.attributes["for"] == nil or (kind and not M.is_exercise(div)),
    "for requires a related pedagogical block, never an exercise")
  local metadata = M.metadata(values)
  if educational and defaults then
    for key, value in pairs(defaults) do if metadata[key] == nil then metadata[key] = value end end
  end
  return kind, metadata
end
return M
