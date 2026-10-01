-- Native Quarto parses eq/table labels before this filter. No source-label parser.
-- Top-down instance wrappers establish scope for their following descendants.
local f=assert(io.open('bundle/manifest.json')); local manifest=pandoc.json.decode(f:read('*a')); f:close()
local suffix, canonical, single
local ids = {['fig-root']=true,['fig-other']=true,['fig-computed']=true,['eq-rule']=true,['tbl-data']=true,['detail']=true}
local function attr(el)
  if suffix and el.identifier and el.identifier ~= '' then el.identifier = el.identifier .. '-' .. suffix end
  return el
end
return {traverse='topdown',
  Div=function(div)
    if div.classes:includes('probe-instance') then
      suffix = div.attributes['data-instance']
      single = div.attributes['data-single'] == 'true'
      canonical = div.attributes['data-canonical'] == 'true'
      return div
    end
    return attr(div)
  end,
  Span=attr, Image=attr, Table=attr, Figure=attr, Header=attr, FloatRefTarget=attr,
  Link=function(link)
    local id=link.target:match('^#(.+)$')
    if suffix and id and ids[id] then link.target=canonical and (manifest.canonicalUrl..'#'..id) or ('#'..id..'-'..suffix) end
    return link
  end,
  Cite=function(cite)
    local id=#cite.citations==1 and cite.citations[1].id
    if canonical and ids[id] then return pandoc.Link('canonical '..id,manifest.canonicalUrl..'#'..id) end
    for _,citation in ipairs(cite.citations) do
      if suffix and ids[citation.id] and not (single and citation.id == 'eq-rule') then citation.id=citation.id..'-'..suffix end
    end
    return cite
  end
}
