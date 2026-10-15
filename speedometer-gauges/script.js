(function () {
  "use strict";

  const { createApp, ref, nextTick, onMounted, onBeforeUnmount } = Vue;

  createApp({
    setup() {
      const rows = ref([]);
      const loading = ref(true);
      const error = ref("");
      let worksheet = null;
      let eventHandler = null;
      let chartInstances = [];
      let resizeObserver = null;

      const formatNumber = value =>
        new Intl.NumberFormat(undefined, {
          maximumFractionDigits: 2
        }).format(value);

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

      const renderCharts = () => {
        nextTick(() => {
          setTimeout(() => {
            rows.value.forEach((row, index) => {
              const el = document.getElementById(`chart-${index}`);
              if (!el) return;

              let instance = chartInstances[index];
              if (!instance) {
                instance = echarts.init(el);
                chartInstances[index] = instance;

                // Setup observer to keep chart responsive to container changes
                if (!resizeObserver && window.ResizeObserver) {
                  resizeObserver = new ResizeObserver(() => {
                    chartInstances.forEach(inst => {
                      if (inst) inst.resize();
                    });
                  });
                }
                if (resizeObserver) {
                  resizeObserver.observe(el.parentElement);
                }
              }

              const actual = row.valid ? row.actual : 0;
              const target = row.valid ? row.target : 100;
              const pct = row.valid ? Math.round((actual / target) * 100) : 0;

              const option = {
                series: [{
                  type: 'gauge',
                  startAngle: 210,
                  endAngle: -30,
                  min: 0,
                  max: target,
                  center: ['50%', '58%'],
                  radius: '82%',
                  pointer: { show: false },
                  progress: {
                    show: true,
                    width: 14,
                    itemStyle: { color: '#0d9488' }
                  },
                  axisLine: {
                    lineStyle: { width: 14, color: [[1, '#f1f5f9']] }
                  },
                  axisTick: { show: false },
                  splitLine: {
                    distance: -14,
                    length: 4,
                    lineStyle: { color: '#cbd5e1', width: 1 }
                  },
                  axisLabel: {
                    distance: -20,
                    color: '#64748b',
                    fontSize: 9,
                    fontWeight: '600',
                    formatter: function (value) {
                      if (value === 0) return '0';
                      if (value === target) return target;
                      return '';
                    }
                  },
                  detail: {
                    formatter: [
                      '{val|' + formatNumber(actual) + '}',
                      '{ffa|' + pct + '%}',
                    ].join('\n'),
                    offsetCenter: [0, '15%'],
                    rich: {
                      val: { fontSize: 24, fontWeight: '800', color: '#0f172a', lineHeight: 30 },
                      ffa: {
                        fontSize: 11,
                        fontWeight: '700',
                        color: '#0d9488',
                        lineHeight: 18,
                        backgroundColor: '#ccfbf1',
                        padding: [2, 6, 2, 6],
                        borderRadius: 8
                      }
                    }
                  },
                  data: [{ value: actual }]
                }]
              };

              instance.setOption(option);
              instance.resize();
            });
          }, 100);
        });
      };

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

          if (categoryIndex < 0 || actualIndex < 0 || targetIndex < 0) {
            throw new Error("Ensure the worksheet contains Category, Actual, and Target.");
          }

          rows.value = data.map(row => {
            const actual = numericValue(cellValue(row[actualIndex]));
            const target = numericValue(cellValue(row[targetIndex]));
            const valid = Number.isFinite(actual) && Number.isFinite(target) && target > 0;

            return {
              category: String(cellValue(row[categoryIndex]) ?? ""),
              actual,
              target,
              valid
            };
          });

          error.value = "";
          renderCharts();
        } catch (err) {
          error.value = `Could not read worksheet data: ${err.message}`;
          console.error("Speedometer error:", err);
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

          const dashboard = tableau.extensions.dashboardContent?.dashboard;
          if (dashboard) {
            worksheet = dashboard.worksheets[0];
          } else {
            worksheet = tableau.extensions.worksheetContent.worksheet;
          }

          if (!worksheet) {
            throw new Error("No target worksheet found for this extension object.");
          }

          eventHandler = () => refresh();
          worksheet.addEventListener(tableau.TableauEventType.SummaryDataChanged, eventHandler);

          await refresh();

          window.addEventListener('resize', () => {
            chartInstances.forEach(instance => {
              if (instance) instance.resize();
            });
          });
        } catch (err) {
          error.value = err.message;
          loading.value = false;
        }
      });

      onBeforeUnmount(() => {
        if (worksheet && eventHandler) {
          worksheet.removeEventListener(tableau.TableauEventType.SummaryDataChanged, eventHandler);
        }
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        chartInstances.forEach(instance => {
          if (instance) instance.dispose();
        });
      });

      return { rows, loading, error, formatNumber };
    }
  }).mount("#app");
})();