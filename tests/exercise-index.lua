local shortcode=assert(loadfile(os.getenv('CANONICAL_EXTENSION')..'/../course-navigation/shortcodes.lua'))()['course-exercise-index']
return {{Pandoc=function(doc)
 local marker=shortcode(pandoc.List(),{role='independent-study',['group-by']='semester,difficulty'},pandoc.MetaMap({}))
 assert(marker.t=='RawBlock' and marker.text:find('independent-study',1,true) and marker.text:find('semester',1,true),'specified index request not carried through marker')
 for _,kwargs in ipairs({{role='unknown'},{['group-by']='source'},{['group-by']='semester,semester'},{inventory='x'}}) do assert(not pcall(shortcode,pandoc.List(),kwargs,pandoc.MetaMap({})),'invalid index request accepted') end
 io.stderr:write('PASS exact role/group-by shortcode request and unknown parameter rejection\n');return doc
end}}
