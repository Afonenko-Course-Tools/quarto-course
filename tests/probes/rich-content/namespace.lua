-- Native Quarto parses eq/table labels before this filter. No source-label parser.
-- Keep Quarto's custom-node dispatcher; a temporary final child closes each scope.
local f=assert(io.open('bundle/manifest.json')); local manifest=pandoc.json.decode(f:read('*a')); f:close()
local scope, stack = nil, {}
local ids = {['fig-root']=true,['fig-other']=true,['fig-computed']=true,['eq-rule']=true,['tbl-data']=true,['detail']=true}
local function attr(el)
  if scope and el.identifier and el.identifier ~= '' then el.identifier = el.identifier .. '-' .. scope.suffix end
  return el
end
return {traverse='topdown',
  Div=function(div)
    if div.classes:includes('probe-namespace-end') then
      -- This private marker is appended below and removed before later phases.
      scope = table.remove(stack).previous
      return {}, false
    end
    if div.classes:includes('probe-instance') then
      table.insert(stack, {previous=scope})
      scope = {suffix=div.attributes['data-instance'],
        single=div.attributes['data-single'] == 'true',
        canonical=div.attributes['data-canonical'] == 'true'}
      div.content:insert(pandoc.Div({}, pandoc.Attr('', {'probe-namespace-end'})))
      return div
    end
    return attr(div)
  end,
  Span=attr, Image=attr, Table=attr, Figure=attr, Header=attr, FloatRefTarget=attr,
  Link=function(link)
    local id=link.target:match('^#(.+)$')
    if scope and id and ids[id] then link.target=scope.canonical and (manifest.canonicalUrl..'#'..id) or ('#'..id..'-'..scope.suffix) end
    return link
  end,
  Cite=function(cite)
    local id=#cite.citations==1 and cite.citations[1].id
    if scope and scope.canonical and ids[id] then return pandoc.Link('canonical '..id,manifest.canonicalUrl..'#'..id) end
    for _,citation in ipairs(cite.citations) do
      if scope and ids[citation.id] and not (scope.single and citation.id == 'eq-rule') then citation.id=citation.id..'-'..scope.suffix end
    end
    return cite
  end
}
