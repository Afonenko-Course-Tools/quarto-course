-- Explicit owner-only computation mode. Jupyter is tested separately; Lua is not called Jupyter.
local function increment(path)
  local file = io.open(path, 'r')
  local count = file and tonumber(file:read('*a')) or 0
  if file then file:close() end
  file = assert(io.open(path, 'w')); file:write(count + 1); file:close()
end
return { Pandoc=function(doc)
  local mode=pandoc.utils.stringify(doc.meta['probe-compute'])
  return doc:walk({Div=function(div)
    if div.classes:includes('filter-sentinel') then increment('filter-count.txt'); return {} end
    if not div.classes:includes('computed-slot') then return end
    if mode == 'lua' then
      increment('execution-count.txt')
      local file=assert(io.open('computed.svg','w'))
      file:write('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"><rect width="160" height="80" fill="green"/><text x="8" y="45">COMPUTED '..(6*7)..'</text></svg>')
      file:close()
    elseif mode ~= 'jupyter' and mode ~= 'r' then error('ADAPTER unknown computation mode') end
    return pandoc.Figure({pandoc.Plain({pandoc.Image('Computed result','computed.svg')})}, {pandoc.Plain('Computed result')}, pandoc.Attr('fig-computed'))
  end})
end }
