(function () {
  "use strict";

  const { createApp, ref, onMounted, onBeforeUnmount } = Vue;

  createApp({
    setup() {
      const cardData = ref({
        // onTrack: 12,
        // atRisk: 7,
        // below: 6
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

          const onTrackIdx = findColumn([/on.*track/i, /^track$/i]);
          const atRiskIdx = findColumn([/at.*risk/i, /^risk$/i]);
          const belowIdx = findColumn([/^below/i, /under/i, /low/i]);

          if (data.length > 0) {
            for (let i = 0; i < data.length; i++) {
              const row = data[i];
              
              for (let c = 0; c < columns.length; c++) {
                const colName = String(columns[c].fieldName || columns[c].caption || "").toLowerCase();
                const cellVal = row[c] ? String(row[c].formattedValue ?? row[c].value ?? "").trim().toLowerCase() : "";
                const numVal = numericValue(row[c] ? (row[c].formattedValue ?? row[c].value) : null);

                if (colName.includes("track") || cellVal.includes("track")) {
                  if (!isNaN(numVal) && numVal !== 0) cardData.value.onTrack = numVal;
                }
                if (colName.includes("risk") || cellVal.includes("risk")) {
                  if (!isNaN(numVal) && numVal !== 0) cardData.value.atRisk = numVal;
                }
                if (colName.includes("below") || colName.includes("under") || colName.includes("low") || cellVal.includes("below") || cellVal.includes("under") || cellVal.includes("low")) {
                  if (!isNaN(numVal)) cardData.value.below = numVal;
                }
              }

              const categoryCol = columns.findIndex(col => /category|class|status|level|measure/i.test(col.fieldName || "") || /category|class|status|level|measure/i.test(col.caption || ""));
              const valueCol = columns.findIndex(col => /value|count|estate|score|data/i.test(col.fieldName || "") || /value|count|estate|score|data/i.test(col.caption || ""));

              if (categoryCol >= 0 && valueCol >= 0 && row[categoryCol] && row[valueCol]) {
                const catVal = String(row[categoryCol].formattedValue ?? row[categoryCol].value).trim().toLowerCase();
                const numVal = numericValue(row[valueCol].formattedValue ?? row[valueCol].value);
                if (catVal.includes("track")) cardData.value.onTrack = numVal ?? cardData.value.onTrack;
                if (catVal.includes("risk")) cardData.value.atRisk = numVal ?? cardData.value.atRisk;
                if (catVal.includes("below") || catVal.includes("under") || catVal.includes("low")) cardData.value.below = numVal ?? cardData.value.below;
              } else {
                if (onTrackIdx >= 0 && row[onTrackIdx]) {
                  const val = numericValue(row[onTrackIdx].formattedValue ?? row[onTrackIdx].value);
                  if (!isNaN(val)) cardData.value.onTrack = val;
                }
                if (atRiskIdx >= 0 && row[atRiskIdx]) {
                  const val = numericValue(row[atRiskIdx].formattedValue ?? row[atRiskIdx].value);
                  if (!isNaN(val)) cardData.value.atRisk = val;
                }
                if (belowIdx >= 0 && row[belowIdx]) {
                  const val = numericValue(row[belowIdx].formattedValue ?? row[belowIdx].value);
                  if (!isNaN(val)) cardData.value.below = val;
                }
              }
            }
          }

          error.value = "";
        } catch (err) {
          error.value = `Could not read worksheet data: ${err.message}`;
          console.error("Yield Status Estates Card error:", err);
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