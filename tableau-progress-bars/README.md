# Tableau Progress Bars — Viz Extension

A minimal custom Tableau Viz Extension that renders one HTML/CSS progress bar per category. It is not a native Tableau bar chart.

## Requirements

- Tableau Desktop with Viz Extensions support (Tableau Desktop 2024.1+).
- Python 3 for the local static server.
- Internet access when loading the Tableau Extensions API script from Tableau's GitHub Pages host.

## 1. Start the local server

Extract this folder, open Terminal in this directory, and run:

```bash
python3 -m http.server 8000
```

Keep the terminal running. Open `http://localhost:8000/progress-bars.html` in a browser. You should see demo progress bars.

## 2. Add it to Tableau Desktop

1. Open a workbook and connect to a data source.
2. Create a worksheet.
3. In the Marks card, open the mark type menu.
4. Choose **Viz Extensions → Add Extension → Access Local Viz Extensions**.
5. Select `progress-bars.trex` from this folder and allow it to run.
6. Map fields in the extension's encoding shelves:
   - **Category**: a dimension, such as `Category`, `Department`, or `Line Item`.
   - **Actual**: the achieved value, such as `Sales` or `Actual Amount`.
   - **Target**: the goal/target measure.
7. If your data has multiple rows per category, the extension sums Actual and Target within each category.

## Data rules

- Progress percentage = `SUM(Actual) / SUM(Target) * 100` per category.
- The visible fill is clamped between 0% and 100%.
- The percentage label can exceed 100% to show overachievement.
- A target of zero or a missing/non-numeric target displays `N/A`.
- The first version is a simple starter; test it against your Tableau version and data before relying on it in production.

## Troubleshooting

- **The page shows demo data in Tableau:** confirm that you allowed the extension and mapped all three encoding shelves.
- **Blank extension / cannot load:** make sure the Python server is still running and the URL is `http://localhost:8000/progress-bars.html`.
- **API library fails to load:** verify internet access to `https://tableau.github.io/extensions-api/lib/tableau.extensions.1.latest.js`.
- **Viz Extensions menu is missing:** confirm your Tableau Desktop version supports Viz Extensions and check **Help → Settings and Performance → Set Dashboard Web View Security → Enable JavaScript**.
- **Fields do not map:** use a string/dimension for Category and numeric measures for Actual and Target.

## Files

- `progress-bars.html` — page and API library
- `progress-bars.css` — visual design
- `progress-bars.js` — demo rendering, Tableau data access, category grouping
- `progress-bars.trex` — Tableau Viz Extension manifest
