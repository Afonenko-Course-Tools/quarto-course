-- Raw public Pandoc facts; CUE alone selects/compares educational declarations.
local M = {}
local function attributes(el)
  local result = pandoc.List()
  local keys = {}; for key in pairs(el.attributes) do table.insert(keys,key) end
  table.sort(keys)
  for _,key in ipairs(keys) do result:insert({key=key,value=el.attributes[key]}) end
  return result
end
local function classes(el)
  local result=pandoc.List(); for _,class in ipairs(el.classes) do result:insert(class) end
  return result
end
function M.collect(doc,source)
  local rows=pandoc.List()
  local function walk(fragment,parents)
    local function capture(el)
      rows:insert({contentJson=el.t=="Div" and pandoc.write(pandoc.Pandoc(el.content),"json") or "",kind=el.t,id=el.identifier,classes=classes(el),attributes=attributes(el),ancestors=parents,order=#rows+1})
    end
    fragment:walk({traverse='topdown',Header=capture,Span=capture,Div=function(div)
      capture(div)
      local ancestors=pandoc.List();for _,parent in ipairs(parents) do ancestors:insert(parent) end
      ancestors:insert({id=div.identifier,classes=classes(div),attributes=attributes(div)})
      walk(pandoc.Pandoc(div.content),ancestors)
      return div,false
    end})
  end
  walk(doc,pandoc.List())
  -- Preserve native facts; do not infer whether an identifier was authored or automatic.
  local headers=pandoc.List()
  for _,block in ipairs(doc.blocks) do
    if block.t=='Header' then headers:insert({id=block.identifier,title=pandoc.utils.stringify(block.content)}) end
  end
  local crossref=doc.meta.crossref
  return {assessmentFacts={enabled=doc.meta.assessment~=nil,headers=headers,
      chapterId=crossref and crossref['chapter-id'] and pandoc.utils.stringify(crossref['chapter-id']) or '',
      title=doc.meta.title and pandoc.utils.stringify(doc.meta.title) or ''},source=source,owner=pandoc.utils.stringify(doc.meta.course.id),occurrences=rows,
    assessment=pandoc.write(pandoc.Pandoc({}, {assessment=doc.meta.assessment}), 'json')}
end
return M
