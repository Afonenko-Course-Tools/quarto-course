-- Post-render: условия и custom nodes уже разрешил сам Quarto.
local dir=pandoc.path.directory(debug.getinfo(1,'S').source:gsub('^@',''))
local occurrences=pandoc.List()
local function clean(div)
  div.attributes['data-course-core-occurrence']=nil
  div.attributes['data-course-core-native-kind']=nil
  return div
end
return {{
  Div=function(div)
    local key=div.attributes['data-course-core-occurrence']
    if key then
      local fragment=pandoc.Pandoc(div.content):walk({Div=clean})
      local body=pandoc.json.decode(pandoc.write(fragment,'json')).blocks
      occurrences[#occurrences+1]={key=key,body=body,nativeKind=div.attributes['data-course-core-native-kind'] or 'Div',anchor=div.identifier}
    end
  end,
  Pandoc=function(doc)
    if not doc.meta['course-core-ts-binding'] then
      assert(pandoc.utils.stringify(doc.meta['course-core-runtime'] or '')~='native-ts','OPERATION_INCOMPLETE: отсутствует early binding')
      return doc
    end
    local request=dofile(pandoc.path.join({dir,'request.lua'}))(doc)
    assert(request,'OPERATION_BINDING: отсутствует late request')
    local binding=doc.meta['course-core-ts-binding']
    local context=pandoc.json.decode(pandoc.utils.stringify(binding))
    local identifier=quarto.format.format_identifier()
    local native_format=identifier['target-format']
    assert((native_format=='html' or native_format=='revealjs') and identifier['base-format']==native_format and FORMAT==native_format and context.format==native_format,'DOCUMENT_BINDING: late native format отличается')
    assert(context.operation==request.context.operation and context.captureWitness==request.context.captureWitness and context.input==request.context.input and context.projection==request.context.projection and pandoc.json.encode(context.profiles)==pandoc.json.encode(request.context.profiles),'DOCUMENT_BINDING: чужой late request')
    local output=request.capture..'.late.json'
    local exists=io.open(output,'rb');if exists then exists:close();error('DOCUMENT_BINDING: late sidecar уже существует') end
    local writer=assert(io.open(output,'wb'));writer:write(pandoc.json.encode({context=context,occurrences=occurrences}));writer:close()
    if not os.getenv('COURSE_CORE_TS_RUN') then
      local output=quarto.doc.output_file
      local body=pandoc.json.decode(pandoc.write(doc:walk({Div=clean}),'json')).blocks
      local native=assert(io.open(request.capture..'.native.json','wb'))
      local observedDoc=pandoc.Pandoc(doc.blocks,{course={view=pandoc.MetaString(context.projection=='author' and 'full' or 'student')}})
      local observation=dofile(pandoc.path.join({dir,'../native-resources.lua'})).facts(observedDoc,observedDoc,{})
      native:write(pandoc.json.encode({output=output,body=body,role=pandoc.utils.stringify(doc.meta['course-core-role'] or 'page'),resources=observation.capturedFiles}));native:close()
    end
    doc.meta['course-core-ts-binding']=nil
    return doc:walk({Div=clean})
  end
}}
