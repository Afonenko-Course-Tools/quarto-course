local M={}
function M.uses(doc)
  local result,seen=pandoc.List(),{}
  local function add(node)
    local target=node.target
    if not target:match('^[%a][%w+.-]*:') and not target:match('^//') and target:sub(1,1)~='#' then
      target=target:gsub('[?#].*$','')
      if target~='' and not seen[target] then result:insert(target);seen[target]=true end
    end
  end
  local function raw(node)
    if node.format=='html' then
      for target in node.text:gmatch('[sS][rR][cC]%s*=%s*["\']([^"\']+)["\']') do add({target=target}) end
      for target in node.text:gmatch('[hH][rR][eE][fF]%s*=%s*["\']([^"\']+)["\']') do add({target=target}) end
    end
  end
  doc:walk({Image=add,Link=add,RawBlock=raw,RawInline=raw});return result
end
function M.facts(raw,public)
  local root=quarto.project.directory
  local input=quarto.doc.input_file;if pandoc.path.is_relative(input) then input=pandoc.path.join({root,input}) end
  local outputRoot=quarto.project.output_directory or root;if pandoc.path.is_relative(outputRoot) then outputRoot=pandoc.path.join({root,outputRoot}) end
  return {source=pandoc.path.make_relative(input,root),format=FORMAT,view=raw.meta.course.view and pandoc.utils.stringify(raw.meta.course.view) or nil,
    effectiveBase=pandoc.path.directory(input),outputDirectory=outputRoot,outputFile=quarto.doc.output_file,rawUses=M.uses(raw),projectedUses=M.uses(public)}
end
return M
