-- Body-only native Link/Image facts. Projection is the production Core projection.
local M={}
local function uses(doc)
  local rows=pandoc.List()
  local opaque=pandoc.List()
  local function walk(fragment,cell,display)
    fragment:walk({traverse='topdown',Div=function(div)
      walk(pandoc.Pandoc(div.content),cell or div.classes:includes('cell'),display or div.classes:includes('cell-output-display'))
      return div,false
    end,RawBlock=function(raw)
      if raw.format=='html' then opaque:insert('RawBlock:html') end
    end,RawInline=function(raw)
      if raw.format=='html' then opaque:insert('RawInline:html') end
    end,Link=function(link)
      rows:insert({kind='Link',target=link.target,order=#rows+1,nativePlot=false})
    end,Image=function(image)
      rows:insert({kind='Image',target=image.src,order=#rows+1,nativePlot=cell and display})
    end})
  end
  walk(pandoc.Pandoc(doc.blocks),false,false)
  return rows,opaque
end
function M.collect(doc,context,project)
  local projected=project(doc:clone())
  local raw,opaque=uses(doc)
  local permitted=uses(projected)
  return {source=context.source,profile=context.profile,phase=context.phase,effectiveBase=context.effectiveBase,
    outputDirectory=context.outputDirectory,outputFile=context.outputFile,raw=raw,projected=permitted,opaque=opaque}
end
return M
