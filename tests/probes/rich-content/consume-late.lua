return { Pandoc = function(doc)
  local f = assert(io.open('bundle/post-ast.json'))
  local late = pandoc.read(f:read('*a'), 'json'); f:close()
  late.meta = doc.meta
  return late
end }
