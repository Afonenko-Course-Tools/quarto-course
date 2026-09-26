local M = {}

local function member_count(doc)
  local count = 0
  doc:walk({Div = function(node)
    if node.classes:includes("assessment-items") then count = count + 1 end
  end})
  return count
end

local function profile_name(value)
  assert(type(value) == "string" and value:match("^[a-z][a-z0-9%-]*$"),
    "Profile selectors require one lowercase profile name, e.g. full")
  return value
end

-- Resolve profile-only conditions now; later Quarto formatting must not decide
-- which assessment facts or private source bodies are exported by the core.
local function condition(node)
  local when, unless
  for _, class in ipairs(node.classes) do
    local prefix, name = class:match("^(when)%-(.*)$")
    if not prefix then prefix, name = class:match("^(unless)%-(.*)$") end
    if prefix == "when" then
      assert(not when, "Use at most one .when-<profile> per element")
      when = profile_name(name)
    elseif prefix == "unless" then
      assert(not unless, "Use at most one .unless-<profile> per element")
      unless = profile_name(name)
    end
  end
  local visible = node.classes:includes("content-visible")
  local hidden = node.classes:includes("content-hidden")
  local standard_when, standard_unless = node.attributes["when-profile"], node.attributes["unless-profile"]
  if not when and not unless and not standard_when and not standard_unless then return nil end
  assert(not (visible and hidden), "An element cannot be both content-visible and content-hidden")
  if when or unless then
    assert(not visible and not hidden and not standard_when and not standard_unless,
      "Do not mix compact and standard profile selectors on one element")
  else
    assert(visible or hidden, "when-profile/unless-profile require content-visible or content-hidden")
    when = standard_when and profile_name(standard_when)
    unless = standard_unless and profile_name(standard_unless)
  end
  for key, _ in pairs(node.attributes) do
    assert(not ((key:match("^when%-") or key:match("^unless%-"))
      and key ~= "when-profile" and key ~= "unless-profile"),
      "Profile projection cannot mix profile and format/meta selectors on one element")
  end
  return {when = when, unless = unless, invert = hidden}
end

local function strip(node)
  node.attributes["when-profile"], node.attributes["unless-profile"] = nil, nil
  node.classes = node.classes:filter(function(class)
    return class ~= "content-visible" and class ~= "content-hidden"
      and not class:match("^when%-") and not class:match("^unless%-")
  end)
end

function M.prepare(doc)
  local raw = doc.meta.course and doc.meta.course.view
  local view = raw and pandoc.utils.stringify(raw) or nil
  assert(not view or view == "student" or view == "full", "course.view must be student or full")
  local active = {}
  for name in (os.getenv("QUARTO_PROFILE") or ""):gmatch("[^, ]+") do active[name] = true end
  assert(not (active.student and active.full), "student and full profiles are mutually exclusive")
  assert(not view or not ((active.student and view ~= "student") or (active.full and view ~= "full")),
    "course.view disagrees with the selected Quarto profile")
  if view then active[view] = true end

  -- Validate hidden branches as well, so authoring errors are profile independent.
  local validate = function(node) condition(node) end
  doc:walk({Div = validate, Span = validate, CodeBlock = validate})
  local before = member_count(doc)
  local function project(node)
    local test = condition(node)
    if not test then return nil end
    local match = (not test.when or active[test.when] == true)
      and (not test.unless or not active[test.unless])
    local keep = test.invert and not match or (not test.invert and match)
    if not keep then return {} end
    strip(node)
    return node
  end
  doc = doc:walk({traverse = "topdown", Div = project, Span = project, CodeBlock = project})
  -- A hidden control has no membership; a visible public PL control stays valid.
  if before > 0 and member_count(doc) == 0 then doc.meta.assessment = nil end
  return doc
end

return M
