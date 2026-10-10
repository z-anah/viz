(function () {
  "use strict";

  const content = document.getElementById("content");
  const status = document.getElementById("status");
  const footer = document.getElementById("footer");

  function formatNumber(value) {
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2
    }).format(value);
  }

  function showMessage(message, isError = false) {
    content.replaceChildren();
    const el = document.createElement("div");
    el.className = isError ? "error" : "empty";
    el.textContent = message;
    content.appendChild(el);
  }

  function render(rows) {
    content.replaceChildren();

    if (!rows.length) {
      showMessage("No data found in the worksheet.");
      return;
    }

    rows.forEach(row => {
      const actual = Number(row.actual);
      const target = Number(row.target);
      const valid = Number.isFinite(actual) &&
        Number.isFinite(target) &&
        target > 0;

      const pct = valid ? actual / target * 100 : 0;
      const displayedPct = Math.max(0, Math.min(100, pct));

      const card = document.createElement("article");
      card.className = "progress-card";

      const heading = document.createElement("div");
      heading.className = "card-heading";

      const name = document.createElement("div");
      name.className = "category";
      name.textContent = row.category || "(Null category)";

      const percent = document.createElement("div");
      percent.className = "percent";
      percent.textContent = valid ? `${formatNumber(pct)}%` : "N/A";

      heading.append(name, percent);

      const track = document.createElement("div");
      track.className = "track";
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", String(displayedPct));

      const fill = document.createElement("div");
      fill.className = "fill";
      fill.style.width = `${displayedPct}%`;
      track.appendChild(fill);

      const foot = document.createElement("div");
      foot.className = "card-footer";

      const actualText = document.createElement("span");
      actualText.textContent = `Actual: ${formatNumber(actual)}`;

      const targetText = document.createElement("span");
      targetText.textContent = `Target: ${formatNumber(target)}`;

      foot.append(actualText, targetText);
      card.append(heading, track, foot);
      content.appendChild(card);
    });
  }

  function cellValue(cell) {
    if (!cell) return null;
    return cell.value ?? cell.formattedValue ?? null;
  }

  function numericValue(value) {
    if (typeof value === "number") return value;
    if (value == null || value === "") return NaN;

    return Number(String(value).replace(/,/g, ""));
  }

  async function refresh(worksheet) {
    try {
      status.textContent = "Loading Tableau data…";

      const table = await worksheet.getSummaryDataAsync();

      const columns = table.columns || [];
      const data = table.data || [];

      const findColumn = patterns =>
        columns.findIndex(column =>
          patterns.some(pattern =>
            pattern.test(column.fieldName || "") ||
            pattern.test(column.caption || "")
          )
        );

      const categoryIndex = findColumn([/^category$/i]);
      const actualIndex = findColumn([/^actual$/i]);
      const targetIndex = findColumn([/^target$/i]);

      if (categoryIndex < 0 || actualIndex < 0 || targetIndex < 0) {
        showMessage(
          "Required columns not found. Ensure the worksheet contains Category, Actual, and Target."
        );
        status.textContent = "Missing columns";
        return;
      }

      const rows = data.map(row => ({
        category: String(cellValue(row[categoryIndex]) ?? ""),
        actual: numericValue(cellValue(row[actualIndex])),
        target: numericValue(cellValue(row[targetIndex]))
      }));

      render(rows);
      status.textContent = "Tableau data";
      footer.textContent =
        `Connected to worksheet: ${worksheet.name}. ` +
        "Data is read directly from Tableau.";
    } catch (error) {
      console.error("Progress Bars error:", error);
      status.textContent = "Data access error";
      showMessage(
        `Could not read worksheet data: ${error.message}`,
        true
      );
    }
  }

  if (!window.tableau?.extensions) {
    status.textContent = "Preview mode";
    showMessage(
      "Open this extension inside Tableau to access workbook data."
    );
    return;
  }

  tableau.extensions.initializeAsync()
    .then(() => {
      const worksheet =
        tableau.extensions.worksheetContent.worksheet;

      worksheet.addEventListener(
        tableau.TableauEventType.SummaryDataChanged,
        () => refresh(worksheet)
      );

      return refresh(worksheet);
    })
    .catch(error => {
      console.error(error);
      status.textContent = "Initialization error";
      showMessage(error.message, true);
    });
})();