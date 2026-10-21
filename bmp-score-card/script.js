(function () {
  "use strict";

  const { createApp, ref, onMounted, onBeforeUnmount } = Vue;

  createApp({
    setup() {
      const cardData = ref({
        bmpScore: 78.1,
        sumatraScore: 84.2,
        kalimantanScore: 73.3,
        sumatraMoM: "1.0",
        kalimantanMoM: "0.8",
        momOverall: "0.5"
      });
      const loading = ref(true);
      const error = ref("");
      let worksheet = null;
      let eventHandler = null;

      const formatPercent = value => {
        if (typeof value !== "number" || isNaN(value)) return "—";
        return `${value.toFixed(1)}%`;
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
          const sumatraIdx = findColumn([/sumatra/i]);
          const kalimantanIdx = findColumn([/kalimantan/i]);

          if (data.length > 0) {
            const row = data[0]; // Take the first summary row or aggregate
            if (bmpScoreIdx >= 0) cardData.value.bmpScore = numericValue(row[bmpScoreIdx].value) || cardData.value.bmpScore;
            if (sumatraIdx >= 0) cardData.value.sumatraScore = numericValue(row[sumatraIdx].value) || cardData.value.sumatraScore;
            if (kalimantanIdx >= 0) cardData.value.kalimantanScore = numericValue(row[kalimantanIdx].value) || cardData.value.kalimantanScore;
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
        if (!window.tableau?.extensions) {
          error.value = "Open this extension inside Tableau.";
          loading.value = false;
          return;
        }

        try {
          await tableau.extensions.initializeAsync();
          worksheet = tableau.extensions.worksheetContent.worksheet;
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
        cardData,
        loading,
        error,
        formatPercent
      };
    }
  }).mount("#app");
})();