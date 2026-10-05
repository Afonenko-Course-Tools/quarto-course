package.path=os.getenv('CANONICAL_EXTENSION')..'/owner-preflight/?.lua;'..package.path
local occurrences=require('occurrences')
return {{Pandoc=function(doc)
  local task=function(id) return pandoc.Div({pandoc.Para('Task')},pandoc.Attr('exr-'..id,{},{{'course-role','discussion'},{'difficulty','introductory'}})) end
  local tabledoc=pandoc.read('| a | b |\n|---|---|\n| c | d |','markdown')
  tabledoc.blocks[1].bodies[1].body[1].cells[1].contents=pandoc.Blocks({pandoc.Header(2,'Cell',pandoc.Attr('sec-cell')),task('cell')})
  tabledoc.blocks[1].bodies[1].body[1].cells[2].contents=pandoc.Blocks({task('other-cell')})
  local body=pandoc.Pandoc({
    pandoc.Header(1,'Root',pandoc.Attr('sec-root')),
    pandoc.BlockQuote({pandoc.Header(2,'Quote',pandoc.Attr('sec-quote')),task('quote')}),
    task('after-quote'),
    pandoc.BulletList({{pandoc.Header(2,'List',pandoc.Attr('sec-list')),task('list')},{task('other-item')}}),
    tabledoc.blocks[1],
  },{course={id='proof'}})
  local raw=occurrences.collect(body,'index.qmd')
  local byid={};for _,row in ipairs(raw.occurrences) do byid[row.id]=row end
  local function prefix(a,b)
    if #a>#b then return false end
    for i,n in ipairs(a) do if b[i]~=n then return false end end
    return true
  end
  assert(prefix(byid['sec-quote'].ancestorOrders,byid['exr-quote'].ancestorOrders),'quote context lost')
  assert(not prefix(byid['sec-quote'].ancestorOrders,byid['exr-after-quote'].ancestorOrders),'quote Header leaked')
  assert(prefix(byid['sec-list'].ancestorOrders,byid['exr-list'].ancestorOrders),'list context lost')
  assert(not prefix(byid['sec-list'].ancestorOrders,byid['exr-other-item'].ancestorOrders),'list Header leaked to sibling item')
  assert(prefix(byid['sec-cell'].ancestorOrders,byid['exr-cell'].ancestorOrders),'table context lost')
  assert(not prefix(byid['sec-cell'].ancestorOrders,byid['exr-other-cell'].ancestorOrders),'table Header leaked to sibling cell')
  return doc
end}}
