(function () {
  "use strict";

  const { createApp, ref, onMounted, onBeforeUnmount, nextTick } = Vue;

  createApp({
    setup() {
      const chartData = ref({
        // sumJunAct: 11.90, sumJulAct: 15.20, sumAugAct: 17.20,
        // kalJunAct: 10.90, kalJulAct: 13.25, kalAugAct: 15.30,
        // sumJunBgt: 11.80, sumJulBgt: 15.09, sumAugBgt: 17.15,
        // kalJunBgt: 10.87, kalJulBgt: 13.19, kalAugBgt: 15.27
      });

      const loading = ref(true);
      const error = ref("");
      const isTableauMode = ref(false);

      let worksheet = null;
      let eventHandler = null;
      let chartInstance = null;

      function numericValue(value) {
        if (typeof value === "number") return value;
        if (value == null || value === "") return NaN;
        return Number(String(value).replace(/,/g, "").trim());
      }

      function initChart(actVals = [11.90, 15.20, 17.20, 10.90, 13.25, 15.30], bgtVals = [11.80, 15.09, 17.15, 10.87, 13.19, 15.27]) {
        const ctx = document.getElementById('yieldChart');
        if (!ctx) return;

        if (chartInstance) {
          chartInstance.destroy();
        }

        chartInstance = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ['SUM Jun', 'SUM Jul', 'SUM Aug', 'KAL Jun', 'KAL Jul', 'KAL Aug'],
            datasets: [
              { 
                label: 'Budget', 
                data: bgtVals, 
                backgroundColor: '#CBD5E1', 
                barPercentage: 0.6, 
                categoryPercentage: 0.6 
              },
              { 
                label: 'Actual', 
                data: actVals, 
                backgroundColor: '#006D65', 
                barPercentage: 0.6, 
                categoryPercentage: 0.6 
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { ticks: { font: { size: 8 } }, grid: { color: '#F1F5F9' } },
              x: { ticks: { font: { size: 8 } }, grid: { display: false } }
            }
          }
        });
      }

      async function refresh() {
        try {
          const table = await worksheet.getSummaryDataAsync();
          const columns = table.columns || [];
          const data = table.data || [];

          if (data.length > 0) {
            const row = data[0];
            const actValues = [];
            const bgtValues = [];

            for (let c = 0; c < columns.length; c++) {
              const val = numericValue(row[c] ? (row[c].formattedValue ?? row[c].value) : null);
              const name = String(columns[c].fieldName || columns[c].caption || "").toLowerCase();
              if (!isNaN(val)) {
                if (name.includes("budget") || name.includes("bgt")) {
                  bgtValues.push(val);
                } else {
                  actValues.push(val);
                }
              }
            }

            await nextTick();
            if (actValues.length > 0 || bgtValues.length > 0) {
              initChart(
                actValues.length > 0 ? actValues : [11.90, 15.20, 17.20, 10.90, 13.25, 15.30],
                bgtValues.length > 0 ? bgtValues : [11.80, 15.09, 17.15, 10.87, 13.19, 15.27]
              );
            }
          }

          error.value = "";
        } catch (err) {
          error.value = `Could not read worksheet data: ${err.message}`;
          console.error("Yield Chart Card error:", err);
        } finally {
          loading.value = false;
        }
      }

      onMounted(async () => {
        await nextTick();
        initChart();

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
        if (chartInstance) {
          chartInstance.destroy();
        }
      });

      return {
        loading,
        error,
        isTableauMode
      };
    }
  }).mount("#app");
})();