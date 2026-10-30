-- Только transport текущего Core producer; условия и metadata разрешает Quarto.
return function(doc)
  local manual=os.getenv('COURSE_CORE_TS_RUN')
  if manual then
    local f=assert(io.open(manual,'rb'));local request=pandoc.json.decode(f:read('*a'));f:close()
    return request,manual
  end
  if pandoc.utils.stringify(doc.meta['course-core-runtime'] or '')~='native-ts' then return nil end
  local root=assert(quarto.project.directory,'OPERATION_BINDING: нет project owner')
  local function read(path)
    local f=assert(io.open(path,'rb'),'OPERATION_INCOMPLETE: отсутствует '..path)
    local value=pandoc.json.decode(f:read('*a'));f:close();return value
  end
  local base=pandoc.path.join({root,'_generated/course-spec/native-ts'})
  local active=read(pandoc.path.join({base,'active.json'}))
  assert(type(active.operation)=='string' and active.operation:match('^[a-f0-9%-]+$') and active.directory==pandoc.path.join({base,active.operation}),'OPERATION_BINDING: чужой native pointer')
  local state=read(pandoc.path.join({active.directory,'state.json'}))
  local input=quarto.doc.input_file
  if pandoc.path.is_relative(input) then input=pandoc.path.join({root,input}) end
  input=pandoc.path.normalize(input)
  for index,source in ipairs(state.inputs) do
    if pandoc.path.normalize(pandoc.path.join({root,source}))==input then
      local path=pandoc.path.join({active.directory,tostring(index-1)..'.request.json'})
      return read(path),path
    end
  end
  error('OPERATION_BINDING: input отсутствует в текущей операции')
end
