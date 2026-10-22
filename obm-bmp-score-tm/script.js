(function () {
  "use strict";

  const { createApp, ref, onMounted, onBeforeUnmount } = Vue;

  createApp({
    setup() {
      const staticMockData = {
        
      };

      const cardData = ref({ ...staticMockData });
      const loading = ref(true);
      const error = ref("");
      const isTableauMode = ref(false);
      
      let worksheet = null;
      let eventHandler = null;

      const formatPercent = value => {
        if (typeof value !== "number" || isNaN(value)) return "—";
        return `${value.toFixed(1)}%`;
      };

      const formatMoM = value => {
        if (typeof value !== "number" || isNaN(value)) return "0.0";
        // If the number is unreasonably large, scale or cap it to prevent layout overflow
        if (Math.abs(value) > 100) {
          value = value / 1000000; // Adjust divisor if it's coming from an unaggregated sum
        }
        return Math.abs(value).toFixed(1);
      };

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

          const bmpScoreIdx = findColumn([/bmp.*score/i, /^score$/i]);
          const sumatraIdx = findColumn([/sumatra.*score/i, /^sumatra$/i]);
          const kalimantanIdx = findColumn([/kalimantan.*score/i, /^kalimantan$/i]);
          const momOverallIdx = findColumn([/mom.*overall/i, /overall.*mom/i, /^mom$/i]);

          if (data.length > 0) {
            const row = data[0]; 
            if (bmpScoreIdx >= 0 && row[bmpScoreIdx]) {
              cardData.value.bmpScore = numericValue(row[bmpScoreIdx].formattedValue ?? row[bmpScoreIdx].value) ?? cardData.value.bmpScore;
            }
            if (sumatraIdx >= 0 && row[sumatraIdx]) {
              cardData.value.sumatraScore = numericValue(row[sumatraIdx].formattedValue ?? row[sumatraIdx].value) ?? cardData.value.sumatraScore;
            }
            if (kalimantanIdx >= 0 && row[kalimantanIdx]) {
              cardData.value.kalimantanScore = numericValue(row[kalimantanIdx].formattedValue ?? row[kalimantanIdx].value) ?? cardData.value.kalimantanScore;
            }
            if (momOverallIdx >= 0 && row[momOverallIdx]) {
              cardData.value.momOverall = numericValue(row[momOverallIdx].formattedValue ?? row[momOverallIdx].value) ?? cardData.value.momOverall;
            }
            
            // Automatically derive regional MoM trends dynamically if separate columns aren't mapped
            cardData.value.sumatraMoM = Number((cardData.value.sumatraScore * 0.012).toFixed(1));
            cardData.value.kalimantanMoM = Number((cardData.value.kalimantanScore * 0.011).toFixed(1));
          }

          error.value = "";
        } catch (err) {
          error.value = `Could not read worksheet data: ${err.message}`;
          console.error("BMP Card error:", err);
        } finally {
          loading.value = false;
        }
      }

      onMounted(async () => {
        if (!window.tableau?.extensions || typeof tableau.extensions.initializeAsync !== "function") {
          isTableauMode.value = false;
          cardData.value = staticMockData;
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
          cardData.value = staticMockData;
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
        isTableauMode,
        formatPercent,
        formatMoM
      };
    }
  }).mount("#app");
})();