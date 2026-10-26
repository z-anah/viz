(function () {
  "use strict";

  const { createApp, ref, onMounted, onBeforeUnmount } = Vue;

  createApp({
    setup() {
      const staticMockData = {
        // high: 9,
        // mid: 5,
        // low: 11,
        // highDiff: "±0",
        // midDiff: "±0"
      };

      const cardData = ref({
        high: 9,
        mid: 5,
        low: 11,
        highDiff: "±0",
        midDiff: "±0"
      });
      const loading = ref(true);
      const error = ref("");
      const isTableauMode = ref(false);

      let worksheet = null;
      let eventHandler = null;

      function numericValue(value) {
        if (typeof value === "number") return value;
        if (value == null || value === "") return NaN;
        return Number(String(value).replace(/,/g, "").trim());
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

          const highIdx = findColumn([/^high$/i, /high.*count/i]);
          const midIdx = findColumn([/^mid$/i, /mid.*count/i]);
          const lowIdx = findColumn([/^low$/i, /low.*count/i]);
          const highDiffIdx = findColumn([/high.*diff/i, /high.*vs/i]);
          const midDiffIdx = findColumn([/mid.*diff/i, /mid.*vs/i]);

          if (data.length > 0) {
            for (let i = 0; i < data.length; i++) {
              const row = data[i];
              const categoryCol = columns.findIndex(col => /category|class|status|level/i.test(col.fieldName || "") || /category|class|status|level/i.test(col.caption || ""));
              const valueCol = columns.findIndex(col => /value|count|estate|score/i.test(col.fieldName || "") || /value|count|estate|score/i.test(col.caption || ""));

              if (categoryCol >= 0 && valueCol >= 0) {
                const catVal = String(row[categoryCol].formattedValue ?? row[categoryCol].value).trim().toLowerCase();
                const numVal = numericValue(row[valueCol].formattedValue ?? row[valueCol].value);
                if (catVal.includes("high")) cardData.value.high = numVal ?? cardData.value.high;
                if (catVal.includes("mid")) cardData.value.mid = numVal ?? cardData.value.mid;
                if (catVal.includes("low")) cardData.value.low = numVal ?? cardData.value.low;
              } else {
                if (highIdx >= 0 && row[highIdx]) {
                  const val = numericValue(row[highIdx].formattedValue ?? row[highIdx].value);
                  if (!isNaN(val)) cardData.value.high = val;
                }
                if (midIdx >= 0 && row[midIdx]) {
                  const val = numericValue(row[midIdx].formattedValue ?? row[midIdx].value);
                  if (!isNaN(val)) cardData.value.mid = val;
                }
                if (lowIdx >= 0 && row[lowIdx]) {
                  const val = numericValue(row[lowIdx].formattedValue ?? row[lowIdx].value);
                  if (!isNaN(val)) cardData.value.low = val;
                }
              }

              if (highDiffIdx >= 0 && row[highDiffIdx]) {
                cardData.value.highDiff = row[highDiffIdx].formattedValue ?? String(row[highDiffIdx].value);
              }
              if (midDiffIdx >= 0 && row[midDiffIdx]) {
                cardData.value.midDiff = row[midDiffIdx].formattedValue ?? String(row[midDiffIdx].value);
              }
            }
          }

          error.value = "";
        } catch (err) {
          error.value = `Could not read worksheet data: ${err.message}`;
          console.error("Distribution TM Estates Card error:", err);
        } finally {
          loading.value = false;
        }
      }

      onMounted(async () => {
        if (!window.tableau?.extensions || typeof tableau.extensions.initializeAsync !== "function") {
          isTableauMode.value = false;
          loading.value = false;
          return;
        }

        try {
          isTableauMode.value = true;
          await tableau.extensions.initializeAsync();
          worksheet = tableau.extensions.worksheetContent.worksheet;
          eventHandler = () => refresh();

          worksheet.addEventListener(
            tableau.TableauEventType.SummaryDataChanged,
            eventHandler
          );

          await refresh();
        } catch (err) {
          isTableauMode.value = false;
          error.value = "";
        } finally {
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
        cardData,
        loading,
        error,
        isTableauMode
      };
    }
  }).mount("#app");
})();