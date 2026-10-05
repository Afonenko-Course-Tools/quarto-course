return {probe=function()
  if os.getenv('INVENTORY_ACTIVE') ~= '1' then
    local f=assert(io.open('shortcode-side-effect','w')); f:write('executed'); f:close()
  end
  return pandoc.Str('NATIVE_SHORTCODE_EXPANDED')
end}
