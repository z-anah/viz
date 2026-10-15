# Source

for f in data.csv progress-bars.css progress-bars.html progress-bars.js progress-bars.trex; do
  echo "===== $f ====="
  cat "$f"
  echo
done

# Terminal

python3 -m http.server 8011