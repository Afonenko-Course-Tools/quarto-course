#!/usr/bin/env fish
# Запускать из любой директории: fish examples/presentation/render.fish
set -l example_dir (path dirname (status filename))
cd $example_dir; or exit 1
quarto render
