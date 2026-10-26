(function () {
  "use strict";

  const { createApp, ref, onMounted, onBeforeUnmount } = Vue;

  createApp({
    setup() {
      const regionBreakdown = ref([
        // { name: 'Sumatra', total: 0, highCount: 0, highPct: 0, highDiff: '', highBar: 0, midCount: 0, midPct: 0, midDiff: '', midBar: 0, lowCount: 0, lowPct: 0, lowBar: 0 },
        // { name: 'Kalimantan', total: 0, highCount: 0, highPct: 0, highDiff: '', highBar: 0, midCount: 0, midPct: 0, midDiff: '', midBar: 0, lowCount: 0, lowPct: 0, lowBar: 0 }
      ]);

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

          if (data.length > 0) {
            const newRegions = [];

            for (let i = 0; i < data.length; i++) {
              const row = data[i];
              let regName = "";
              let total = 1, highCount = 0, highPct = 0, highDiff = "±0", midCount = 0, midPct = 0, midDiff = "±0", lowCount = 0, lowPct = 0;

              for (let c = 0; c < columns.length; c++) {
                const colName = String(columns[c].fieldName || columns[c].caption || "").toLowerCase();
                const cellVal = row[c] ? String(row[c].formattedValue ?? row[c].value ?? "").trim() : "";
                const numVal = numericValue(row[c] ? (row[c].formattedValue ?? row[c].value) : null);

                if (colName.includes("region") || colName.includes("estate") || colName.includes("name") || c === 0) {
                  if (cellVal) regName = cellVal;
                }
                if (colName.includes("total")) total = isNaN(numVal) ? 1 : numVal;
                if (colName.includes("high") && colName.includes("count")) highCount = isNaN(numVal) ? 0 : numVal;
                if (colName.includes("high") && colName.includes("pct")) highPct = isNaN(numVal) ? 0 : numVal;
                if (colName.includes("high") && colName.includes("diff")) highDiff = cellVal;
                if (colName.includes("mid") && colName.includes("count")) midCount = isNaN(numVal) ? 0 : numVal;
                if (colName.includes("mid") && colName.includes("pct")) midPct = isNaN(numVal) ? 0 : numVal;
                if (colName.includes("mid") && colName.includes("diff")) midDiff = cellVal;
                if (colName.includes("low") && colName.includes("count")) lowCount = isNaN(numVal) ? 0 : numVal;
                if (colName.includes("low") && colName.includes("pct")) lowPct = isNaN(numVal) ? 0 : numVal;
              }

              if (!regName) {
                regName = i === 0 ? "Sumatra" : "Kalimantan";
              }

              if (total === 0) total = highCount + midCount + lowCount || 1;
              if (highPct === 0 && total > 0) highPct = Math.round((highCount / total) * 100);
              if (midPct === 0 && total > 0) midPct = Math.round((midCount / total) * 100);
              if (lowPct === 0 && total > 0) lowPct = Math.round((lowCount / total) * 100);

              newRegions.push({
                name: regName,
                total: total,
                highCount: highCount,
                highPct: highPct,
                highDiff: highDiff || "±0",
                highBar: highPct,
                midCount: midCount,
                midPct: midPct,
                midDiff: midDiff || "±0",
                midBar: midPct,
                lowCount: lowCount,
                lowPct: lowPct,
                lowBar: lowPct
              });
            }

            if (newRegions.length > 0) {
              regionBreakdown.value = newRegions;
            }
          }

          error.value = "";
        } catch (err) {
          error.value = `Could not read worksheet data: ${err.message}`;
          console.error("High Mid Low Region Card error:", err);
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
        regionBreakdown,
        loading,
        error,
        isTableauMode
      };
    }
  }).mount("#app");
})();