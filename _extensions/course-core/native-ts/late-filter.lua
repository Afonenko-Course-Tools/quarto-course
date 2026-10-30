-- Post-render: условия и custom nodes уже разрешил сам Quarto.
local path=assert(os.getenv('COURSE_CORE_TS_RUN'),'COURSE_CORE_TS_RUN отсутствует')
local file=assert(io.open(path,'rb'));local request=pandoc.json.decode(file:read('*a'));file:close()
local occurrences={}
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
    local binding=assert(doc.meta['course-core-ts-binding'],'DOCUMENT_BINDING: отсутствует early binding')
    local context=pandoc.json.decode(pandoc.utils.stringify(binding))
    assert(context.operation==request.context.operation and context.input==request.context.input and context.format==request.context.format and context.projection==request.context.projection,'DOCUMENT_BINDING: чужой late request')
    local output=request.capture..'.late.json'
    local exists=io.open(output,'rb');if exists then exists:close();error('DOCUMENT_BINDING: late sidecar уже существует') end
    local writer=assert(io.open(output,'wb'));writer:write(pandoc.json.encode({context=context,occurrences=occurrences}));writer:close()
    doc.meta['course-core-ts-binding']=nil
    return doc:walk({Div=clean})
  end
}}
