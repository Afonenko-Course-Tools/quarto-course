local collector=require('./occurrences')
local M={}
function M.process(doc)
  local session=os.getenv('COURSE_OWNER_SESSION')
  if not session then return false end
  local phase=assert(os.getenv('COURSE_OWNER_PHASE'),'SOURCE.ATTEMPT_PHASE_MISSING')
  assert(phase=='capture' or phase=='render','SOURCE.ATTEMPT_PHASE_INVALID')
  local root=assert(quarto.project.directory,'SOURCE.OWNER_PROJECT_REQUIRED')
  local source=quarto.doc.input_file
  if pandoc.path.is_relative(source) then source=pandoc.path.join({root,source}) end
  source=pandoc.path.make_relative(source,root)
  local profile=assert(os.getenv('COURSE_OWNER_PROFILE'),'SOURCE.ATTEMPT_PROFILE_MISSING')
  local directory=pandoc.path.join({root,'.course-owner',phase,profile})
  pandoc.system.make_directory(directory,true)
  local path=directory..'/'..pandoc.utils.sha1(source)..'.json'
  local file=assert(io.open(path,'w'));file:write(pandoc.json.encode(collector.collect(doc,source)));file:close()
  if phase=='capture' then return true end
  local executable=assert(os.getenv('COURSE_OWNER_QUARTO'),'SOURCE.ATTEMPT_QUARTO_MISSING')
  local helper=assert(os.getenv('COURSE_OWNER_HELPER'),'SOURCE.ATTEMPT_HELPER_MISSING')
  local ok,output=pcall(pandoc.pipe,executable,{'run',helper,session,path},'')
  if not ok then io.stderr:write(tostring(output)..'\n');os.exit(1) end
  local result=pandoc.json.decode(output)
  if result.status~='ok' then io.stderr:write(output..'\n');os.exit(1) end
  return false
end
return M
