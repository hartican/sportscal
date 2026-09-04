(function attachAflFamilyMigrationUi(root){
  "use strict";
  const style = document.createElement("style");
  style.textContent = ".afl-family-options{display:grid;grid-template-columns:1fr 1fr;gap:7px;width:100%}.afl-family-options .btn{min-height:38px;padding:7px;font-size:.68rem}.afl-family-migration{margin:0 0 12px;padding:13px;border:1px solid color-mix(in srgb,var(--c-afl) 55%,var(--border));border-radius:10px;background:color-mix(in srgb,var(--c-afl) 9%,var(--bg-card))}.afl-family-migration strong{display:block;font-size:.82rem}.afl-family-migration p{margin:5px 0 10px;color:var(--text-dim);font-size:.72rem;line-height:1.45}.afl-family-migration-actions{display:flex;flex-wrap:wrap;gap:7px}";
  document.head.appendChild(style);

  function build(onSelect){
    const migration = document.createElement("div");
    migration.className = "afl-family-migration";
    migration.innerHTML = "<strong>AFL now includes AFL Premiership and AFLW</strong><p>Your existing AFL follow stays Premiership-only until you choose. Add AFLW, keep Premiership, or follow both.</p>";
    const actions = document.createElement("div");
    actions.className = "afl-family-migration-actions";
    [["Premiership", ["sport:afl-premiership"]], ["AFLW", ["sport:aflw"]], ["Both", ["sport:afl-premiership", "sport:aflw"]], ["Dismiss", null]].forEach(([label, ids]) => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "btn ghost"; button.textContent = label;
      button.addEventListener("click", () => onSelect(ids));
      actions.appendChild(button);
    });
    migration.appendChild(actions);
    return migration;
  }

  function buildOptions(isSelected, onToggle){
    const options = document.createElement("div"); options.className = "afl-family-options";
    [["sport:afl-premiership", "AFL Premiership"], ["sport:aflw", "AFLW"]].forEach(([id, label]) => {
      const active = isSelected(id), button = document.createElement("button");
      button.type = "button"; button.className = `btn ghost${active ? " active" : ""}`; button.setAttribute("aria-pressed", String(active)); button.textContent = active ? `Following ${label}` : `Follow ${label}`;
      button.addEventListener("click", () => onToggle(id, label, active)); options.appendChild(button);
    });
    return options;
  }

  root.NOTHINGSPORTS_AFL_FAMILY_MIGRATION_UI = Object.freeze({ build, buildOptions });
})(typeof globalThis !== "undefined" ? globalThis : window);
