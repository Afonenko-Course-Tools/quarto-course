-- Experimental standard Pandoc JSON at the documented pre-ast phase.
-- No Quarto registry access. Narrow fixture capabilities, not an arbitrary AST contract.
local function write(path, text)
  local f = assert(io.open(path, 'wb')); f:write(text); f:close()
end
local function read(path)
  local f = assert(io.open(path, 'rb')); local text = f:read('*a'); f:close(); return text
end
return { Pandoc = function(doc)
  local prompt, solution
  local exercises, solutions = 0, 0
  doc:walk({Div = function(div)
    if div.identifier == 'exr-rich' then prompt = div:clone(); exercises = exercises + 1 end
    if div.identifier == 'sol-rich' then solution = div:clone(); solutions = solutions + 1 end
  end})
  assert(prompt and solution, 'ADAPTER owner.qmd/exr-rich: required content missing')
  prompt = prompt:walk({Div = function(div)
    if div.classes:includes('solution') then return {} end
  end})
  pandoc.system.make_directory('bundle/resources', true)
  local resources, seen = {}, {}
  local function asset(image)
    local source = image.src
    assert(not source:match('^https?://'), 'ADAPTER remote image not supported by this proof')
    local bytes = read(source)
    local hash = pandoc.utils.sha1(bytes)
    local target = 'resources/' .. hash .. '-' .. pandoc.path.filename(source)
    if not seen[source] then
      seen[source] = true
      resources[#resources + 1] = {source=source, target=target, hash=hash,
        effectiveBase='owner.qmd', physicalProvenance=source == 'computed.svg' and 'owner computation (mode in results)' or 'fragments/task.qmd'}
      write('bundle/' .. target, bytes)
    end
    image.src = 'bundle/' .. target
    return image
  end
  prompt = prompt:walk({Image=asset})
  solution = solution:walk({Image=asset})
  write('bundle/prompt.json', pandoc.write(pandoc.Pandoc(prompt.content), 'json'))
  write('bundle/solution.json', pandoc.write(pandoc.Pandoc(solution.content), 'json'))
  write('bundle/refs.bib', read('refs.bib'))
  write('bundle/manifest.json', pandoc.json.encode({experimental=true,phase='pre-ast',
    owner='fixture-owner',id='exr-rich',canonical={exercises=exercises,solutions=solutions},
    canonicalUrl='../owner/owner.html', resources=resources}))
  return doc
end }
