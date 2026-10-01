-- Only standard Pandoc read/walk constructors, inserted before native Quarto AST/crossrefs.
local function read(path)
  local f = assert(io.open(path)); local data = f:read('*a'); f:close(); return data
end
local function content(part)
  return pandoc.read(read('bundle/' .. part .. '.json'), 'json')
end
return { Pandoc = function(doc)
  local manifest = pandoc.json.decode(read('bundle/manifest.json'))
  local mode = pandoc.utils.stringify(doc.meta['probe-mode'])
  local blocks = doc.blocks
  if mode == 'repeat-inline' then
    -- Conservatively reject display math rather than parse Quarto equation-label text.
    content('prompt'):walk({Math=function(math)
      if math.mathtype == 'DisplayMath' then
        io.stderr:write('ADAPTER owner.qmd/exr-rich: repeated inline display equations are unsupported at documented AST boundaries\n')
        os.exit(1)
      end
    end})
  end
  local function append_instance(suffix, canonical, include_prompt, include_solution)
    local items = pandoc.Blocks({})
    if include_prompt then items:extend(content('prompt').blocks) end
    if include_solution then items:extend(content('solution').blocks) end
    blocks:insert(pandoc.Div(items, pandoc.Attr('task-instance-'..mode..'-'..suffix, {'probe-instance'}, {['data-instance']=suffix, ['data-single']=mode ~= 'unsafe-inline' and 'true' or 'false', ['data-canonical']=canonical and 'true' or 'false'})))
  end
  if mode == 'links' then
    blocks:insert(pandoc.Para({pandoc.Link('Canonical condition', manifest.canonicalUrl .. '#exr-rich')}))
    append_instance('links',true,false,true)
  elseif mode == 'unsafe-inline' or mode == 'inline' or mode == 'second' or mode == 'print' then
    for _, suffix in ipairs(mode == 'unsafe-inline' and {'one','two'} or {'one'}) do
      blocks:insert(pandoc.Para({pandoc.Link('Canonical condition', manifest.canonicalUrl .. '#exr-rich')}))
      append_instance(suffix,false,true,mode ~= 'print')
      if mode == 'print' then blocks:insert(pandoc.Para('Answer area: ____________________________________')) end
    end
  else error('ADAPTER: unsupported probe-mode ' .. mode) end
  return pandoc.Pandoc(blocks, doc.meta)
end }
