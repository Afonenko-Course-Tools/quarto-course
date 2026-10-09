-- Native post-render replaces this request using this run's completed Core facts.
return {['course-exercise-index']=function(args,kwargs,meta)
 if #args>0 or next(kwargs)~=nil then error('course-exercise-index does not accept authored inventory') end
 return pandoc.RawBlock('html','<!--course-exercise-index-->')
end}
