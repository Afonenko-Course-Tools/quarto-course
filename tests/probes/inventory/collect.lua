-- Prototype only: public Pandoc traversal + Quarto JSON; no projection or dedupe.
function Pandoc(doc)
  local rows = pandoc.List()
  local function attrs(node)
    local classes, attributes = {}, {}
    for _, value in ipairs(node.classes) do table.insert(classes, value) end
    for key, value in pairs(node.attributes) do attributes[key] = value end
    return classes, attributes
  end
  local function walk(fragment, ancestors)
    local function capture(node)
      local classes, attributes = attrs(node)
      rows:insert({kind=node.t, id=node.identifier, classes=classes,
        attributes=attributes, ancestors=ancestors, text=pandoc.utils.stringify(node)})
    end
    fragment:walk({traverse='topdown', Header=capture, Div=function(div)
      capture(div)
      local parents = {}
      for _, parent in ipairs(ancestors) do table.insert(parents, parent) end
      local classes, attributes = attrs(div)
      table.insert(parents, {id=div.identifier, classes=classes, attributes=attributes})
      walk(pandoc.Pandoc(div.content), parents)
      return div, false
    end})
  end
  walk(doc, {})
  local input = assert(os.getenv('INVENTORY_SOURCE'), 'collector requires explicit owner source')
  local file = assert(io.open(input .. '.inventory.json', 'w'))
  file:write(quarto.json.encode({source=input, occurrences=rows,
    title=pandoc.utils.stringify(doc.meta.title or ''),
    view=pandoc.utils.stringify(doc.meta.course and doc.meta.course.view or '')}))
  file:close()
end
