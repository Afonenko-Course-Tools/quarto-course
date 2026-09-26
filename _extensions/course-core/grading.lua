local M = {}

local function notes(node) return node.classes:includes("grading-notes") end

-- Instructor guidance belongs to an exercise, never to its student statement.
function M.prepare(doc)
  local total, contained = 0, 0
  doc:walk({Div = function(node)
    if notes(node) then total = total + 1 end
    if node.attributes.target then
      pandoc.Pandoc(node.content):walk({Div = function(child)
        if notes(child) then contained = contained + 1 end
      end})
    end
    if notes(node) then
      assert(not node.attributes.target, "grading-notes cannot itself be an exercise")
      pandoc.Pandoc(node.content):walk({Div = function(child)
        assert(not notes(child), "grading-notes cannot be nested")
        assert(not child.attributes.target, "grading-notes cannot contain an exercise")
        assert(not child.classes:includes("assessment-items"), "grading-notes cannot contain assessment-items")
      end})
    end
  end})
  assert(total == contained, "Every grading-notes block must belong to exactly one exercise")
  if total > 0 then
    assert(doc.meta.course.view, "grading-notes require explicit course.view: student or full")
    if pandoc.utils.stringify(doc.meta.course.view) == "student" then
      doc = doc:walk({Div = function(node) if notes(node) then return {} end end})
    end
  end
  return doc
end

function M.split(blocks)
  local collected = pandoc.List()
  local body = pandoc.Pandoc(blocks):walk({Div = function(node)
    if notes(node) then
      collected:insert(pandoc.write(pandoc.Pandoc(node.content), "json"))
      return {}
    end
  end})
  return pandoc.write(body, "json"), collected
end

return M
