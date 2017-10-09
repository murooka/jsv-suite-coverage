#!/bin/bash

while IFS= read -r -d '' f; do
  echo "$f"
  node dist/main.js "$f"
done < <(find ./suites -name '*.json' -print0)
