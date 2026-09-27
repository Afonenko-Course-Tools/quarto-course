local contract = require("./contract")
local grading = require("../grading")
local M = {}

local function title(div)
  if div.attributes.title then return div.attributes.title end
  local first = div.content[1]
  return first and first.t == "Header" and pandoc.utils.stringify(first) or nil
end

-- Profile projection has already happened. An index over actual native exr
-- nodes also supports ungraded questions without changing grading membership.
local function exercise_index(doc)
  local indexed = {}
  doc:walk({traverse="topdown", Div=function(div)
    if div.classes:includes("grading-notes") then return div, false end
    if contract.is_exercise(div) then
      assert(div.identifier:match("^exr%-[a-z0-9][a-z0-9%-]*$"), "Invalid exercise ID: " .. div.identifier)
      assert(not indexed[div.identifier], "Duplicate native exercise ID: " .. div.identifier)
      indexed[div.identifier] = true
    end
  end})
  return indexed
end

function M.collect(doc)
  if pandoc.utils.stringify(doc.meta.course.schema) ~= "1.1" then
    local message = 'Pedagogical metadata requires course.schema: "1.1" (Course Core >= 1.2)'
    assert(doc.meta["course-pedagogy"] == nil, message)
    doc:walk({Div=function(div)
      for key, _ in pairs(div.attributes) do assert(not contract.attributes[key], message) end
    end})
    -- Preserve the exact 1.0 IR contract for unannotated native Quarto objects.
    return nil
  end
  local defaults = contract.defaults(doc.meta)
  local indexed = exercise_index(doc)
  local result, identities = pandoc.List(), {}
  local function walk(document, owner)
    return document:walk({traverse="topdown", Div=function(div)
      if div.classes:includes("grading-notes") then return div, false end
      local kind, metadata = contract.describe(div, defaults, owner)
      local own = contract.is_exercise(div)
      local related = div.attributes["for"] or owner
      if div.attributes["for"] then
        assert(indexed[related], "Pedagogy for target must be a visible exercise in this document: " .. related)
        assert(not owner or owner == related, "Pedagogy for conflicts with its enclosing exercise: " .. related)
      end
      if kind then
        local id = div.identifier ~= "" and div.identifier or nil
        if id then
          assert(not identities[id], "Duplicate pedagogical ID: " .. id)
          identities[id] = true
        end
        -- grading-notes are a separate full-view field, not public pedagogy.
        local body = grading.split(div.content)
        result:insert({kind=kind, id=id, exercise=not own and related or nil,
          title=title(div), metadata=next(metadata) and metadata or nil,
          bodyJson=body, order=#result + 1})
      end
      -- Explicit recursion is needed to scope ownership; false prevents a
      -- second walk through the same subtree and duplicate facts.
      walk(pandoc.Pandoc(div.content), own and div.identifier or owner)
      return div, false
    end})
  end
  walk(doc, nil)
  if #result == 0 and not defaults then return nil end
  return {elements=result, defaults=defaults and next(defaults) and defaults or nil}
end
return M
