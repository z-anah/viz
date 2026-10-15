
(function () {
  "use strict";

  const { createApp, ref, onMounted, onBeforeUnmount } = Vue;

  createApp({
    setup() {
      const rows = ref([]);
      const loading = ref(true);
      const error = ref("");
      let worksheet = null;
      let eventHandler = null;

      const formatNumber = value =>
        new Intl.NumberFormat(undefined, {
          maximumFractionDigits: 2
        }).format(value);

      const formatPercent = value =>
        `${new Intl.NumberFormat(undefined, {
          maximumFractionDigits: 1
        }).format(value)}%`;

      function cellValue(cell) {
        return cell?.value ?? cell?.formattedValue ?? null;
      }

      function numericValue(value) {
        if (typeof value === "number") return value;
        if (value == null || value === "") return NaN;

        return Number(
          String(value)
            .replace(/[\uFEFF\ufffe]/g, "")
            .replace(/,/g, "")
            .trim()
        );
      }

      async function refresh() {
        try {
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

          const categoryIndex = findColumn([/category/i]);
          const actualIndex = findColumn([/^actual$/i, /actual/i]);
          const targetIndex = findColumn([/^target$/i, /target/i]);

          if (
            categoryIndex < 0 ||
            actualIndex < 0 ||
            targetIndex < 0
          ) {
            throw new Error(
              "Ensure the worksheet contains Category, Actual, and Target."
            );
          }

          rows.value = data.map(row => {
            const actual = numericValue(cellValue(row[actualIndex]));
            const target = numericValue(cellValue(row[targetIndex]));
            const valid =
              Number.isFinite(actual) &&
              Number.isFinite(target) &&
              target > 0;

            return {
              category: String(
                cellValue(row[categoryIndex]) ?? ""
              ),
              actual,
              target,
              valid,
              pct: valid ? actual / target * 100 : 0
            };
          });

          error.value = "";
        } catch (err) {
          error.value = `Could not read worksheet data: ${err.message}`;
          console.error("Progress Bars error:", err);
        } finally {
          loading.value = false;
        }
      }

      onMounted(async () => {
        if (!window.tableau?.extensions) {
          error.value = "Open this extension inside Tableau.";
          loading.value = false;
          return;
        }

        try {
          await tableau.extensions.initializeAsync();

          worksheet =
            tableau.extensions.worksheetContent.worksheet;

          eventHandler = () => refresh();

          worksheet.addEventListener(
            tableau.TableauEventType.SummaryDataChanged,
            eventHandler
          );

          await refresh();
        } catch (err) {
          error.value = err.message;
          loading.value = false;
        }
      });

      onBeforeUnmount(() => {
        if (worksheet && eventHandler) {
          worksheet.removeEventListener(
            tableau.TableauEventType.SummaryDataChanged,
            eventHandler
          );
        }
      });

      return {
        rows,
        loading,
        error,
        formatNumber,
        formatPercent
      };
    }
  }).mount("#app");
})();