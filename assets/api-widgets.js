/**
 * PassCerfa — API Widgets
 * APIs publiques sans authentification : BAN, Geo gouv, OpenFisca, liens profonds
 */
(function () {
  'use strict';

  /* ── 1. AUTOCOMPLETE ADRESSE (API BAN) ──────────────────────────── */
  function initAdresseAutocomplete(input) {
    if (!input) return;
    let timer, dropdown;

    dropdown = document.createElement('ul');
    dropdown.className = 'ban-dropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.setAttribute('aria-label', 'Suggestions d\'adresses');
    input.insertAdjacentElement('afterend', dropdown);

    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-haspopup', 'listbox');

    function close() { dropdown.innerHTML = ''; dropdown.hidden = true; }

    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 3) { close(); return; }
      timer = setTimeout(async () => {
        try {
          const r = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`);
          const data = await r.json();
          dropdown.innerHTML = '';
          if (!data.features.length) { close(); return; }
          data.features.forEach(f => {
            const li = document.createElement('li');
            li.textContent = f.properties.label;
            li.setAttribute('role', 'option');
            li.tabIndex = -1;
            li.addEventListener('mousedown', e => { e.preventDefault(); input.value = f.properties.label; close(); input.dispatchEvent(new Event('change')); });
            dropdown.appendChild(li);
          });
          dropdown.hidden = false;
        } catch { close(); }
      }, 300);
    });

    input.addEventListener('keydown', e => {
      const items = dropdown.querySelectorAll('li');
      const cur = dropdown.querySelector('li:focus');
      if (e.key === 'ArrowDown') { e.preventDefault(); (cur ? cur.nextElementSibling || items[0] : items[0])?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (cur ? cur.previousElementSibling || items[items.length - 1] : items[items.length - 1])?.focus(); }
      else if (e.key === 'Escape') close();
    });

    document.addEventListener('click', e => { if (!dropdown.contains(e.target) && e.target !== input) close(); });
  }

  /* ── 2. COMMUNE PAR CODE POSTAL (API Geo gouv) ───────────────────── */
  function initCommuneAutocomplete(inputCP, inputCommune) {
    if (!inputCP || !inputCommune) return;
    inputCP.addEventListener('input', async () => {
      const cp = inputCP.value.trim();
      if (cp.length !== 5) return;
      try {
        const r = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom,code&format=json`);
        const data = await r.json();
        if (!data.length) return;
        if (data.length === 1) { inputCommune.value = data[0].nom; return; }
        const sel = document.createElement('select');
        sel.setAttribute('aria-label', 'Choisir la commune');
        data.forEach(c => { const o = document.createElement('option'); o.value = c.nom; o.textContent = c.nom; sel.appendChild(o); });
        sel.addEventListener('change', () => { inputCommune.value = sel.value; sel.replaceWith(inputCommune); });
        inputCommune.replaceWith(sel);
      } catch {}
    });
  }

  /* ── 3. SIMULATEUR DROITS (OpenFisca France public) ─────────────── */
  function buildSimulateur(container, type) {
    if (!container) return;
    const OPENFISCA = 'https://api.openfisca.fr/api/v1/calculate';

    const tpl = {
      rsa: {
        titre: 'Simulateur RSA',
        champs: [
          { id: 'salaire', label: 'Salaire mensuel net (€)', type: 'number', min: 0, max: 10000, def: 0 },
          { id: 'enfants', label: 'Nombre d\'enfants à charge', type: 'number', min: 0, max: 10, def: 0 },
          { id: 'conjoint', label: 'En couple', type: 'checkbox', def: false }
        ],
        variable: 'rsa',
        build: (v) => buildSituation(v, 'rsa')
      },
      aph: {
        titre: 'Simulateur APL (logement)',
        champs: [
          { id: 'loyer', label: 'Loyer mensuel (€)', type: 'number', min: 0, max: 3000, def: 500 },
          { id: 'revenu', label: 'Revenu mensuel net (€)', type: 'number', min: 0, max: 10000, def: 1200 },
          { id: 'zone', label: 'Zone logement', type: 'select', options: ['zone1', 'zone2', 'zone3'], labels: ['Zone 1 (Paris/IDF)', 'Zone 2 (grandes villes)', 'Zone 3 (reste France)'], def: 'zone2' }
        ],
        variable: 'aide_logement',
        build: (v) => buildSituation(v, 'apl')
      },
      aah: {
        titre: 'Simulateur AAH (éligibilité)',
        champs: [
          { id: 'revenu', label: 'Revenu mensuel net (€)', type: 'number', min: 0, max: 5000, def: 0 },
          { id: 'conjoint_revenu', label: 'Revenu conjoint mensuel net (€)', type: 'number', min: 0, max: 5000, def: 0 },
          { id: 'taux_incapacite', label: 'Taux d\'incapacité reconnu (%)', type: 'select', options: ['50', '80'], labels: ['Entre 50% et 79%', '80% ou plus'], def: '80' }
        ],
        variable: 'aah',
        build: (v) => buildSituation(v, 'aah')
      }
    };

    function buildSituation(vals, t) {
      const individu = {
        salaire_de_base: {},
        chomage_brut: {},
        pensions_alimentaires_percues: {}
      };
      const month = new Date().toISOString().slice(0, 7);

      if (t === 'rsa') {
        individu.salaire_de_base[month] = Number(vals.salaire) * 12 / 52 * 4.33;
      } else if (t === 'apl' || t === 'aah') {
        individu.salaire_de_base[month] = Number(vals.revenu) * 12 / 52 * 4.33;
      }

      const situation = {
        individus: { individu0: individu },
        familles: { famille0: { parents: ['individu0'], enfants: [] } },
        foyers_fiscaux: { foyer0: { declarants: ['individu0'], personnes_a_charge: [] } },
        menages: { menage0: { personne_de_reference: ['individu0'], conjoint: [], enfants: [] } }
      };

      if (vals.enfants > 0) {
        for (let i = 0; i < vals.enfants; i++) {
          const enf = `enfant${i}`;
          situation.individus[enf] = { date_naissance: { ETERNITY: `${new Date().getFullYear() - 5}-01-01` } };
          situation.familles.famille0.enfants.push(enf);
          situation.foyers_fiscaux.foyer0.personnes_a_charge.push(enf);
          situation.menages.menage0.enfants.push(enf);
        }
      }
      return { situations: [situation], variables: [t === 'rsa' ? 'rsa' : t === 'apl' ? 'aide_logement' : 'aah'] };
    }

    const cfg = tpl[type];
    if (!cfg) return;

    const form = document.createElement('form');
    form.className = 'simulateur-form';
    form.setAttribute('aria-label', cfg.titre);
    form.innerHTML = `<h3>${cfg.titre}</h3>`;

    cfg.champs.forEach(c => {
      const wrap = document.createElement('div');
      wrap.className = 'sim-field';
      if (c.type === 'checkbox') {
        wrap.innerHTML = `<label><input type="checkbox" id="sim-${c.id}" ${c.def ? 'checked' : ''}> ${c.label}</label>`;
      } else if (c.type === 'select') {
        const opts = c.options.map((o, i) => `<option value="${o}"${o === c.def ? ' selected' : ''}>${c.labels[i]}</option>`).join('');
        wrap.innerHTML = `<label for="sim-${c.id}">${c.label}</label><select id="sim-${c.id}">${opts}</select>`;
      } else {
        wrap.innerHTML = `<label for="sim-${c.id}">${c.label}</label><input type="${c.type}" id="sim-${c.id}" value="${c.def}" min="${c.min}" max="${c.max}">`;
      }
      form.appendChild(wrap);
    });

    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.className = 'btn btn-primary';
    btn.textContent = 'Simuler';
    form.appendChild(btn);

    const result = document.createElement('div');
    result.className = 'sim-result';
    result.setAttribute('role', 'status');
    result.setAttribute('aria-live', 'polite');
    result.hidden = true;
    form.appendChild(result);

    form.addEventListener('submit', async e => {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = 'Calcul en cours…';
      result.hidden = true;

      const vals = {};
      cfg.champs.forEach(c => {
        const el = form.querySelector(`#sim-${c.id}`);
        vals[c.id] = c.type === 'checkbox' ? el.checked : el.value;
      });

      try {
        const payload = cfg.build(vals);
        const r = await fetch(OPENFISCA, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!r.ok) throw new Error();
        const data = await r.json();
        const variable = payload.variables[0];
        const monthKey = Object.keys(data.situations[0].individus?.individu0?.[variable] || {})[0]
          || Object.keys(data.situations[0].familles?.famille0?.[variable] || {})[0]
          || Object.keys(data.situations[0].menages?.menage0?.[variable] || {})[0];
        const montant = data.situations[0].individus?.individu0?.[variable]?.[monthKey]
          ?? data.situations[0].familles?.famille0?.[variable]?.[monthKey]
          ?? data.situations[0].menages?.menage0?.[variable]?.[monthKey]
          ?? null;

        if (montant !== null) {
          result.innerHTML = montant > 0
            ? `<p class="sim-ok">✅ Montant estimé : <strong>${Math.round(montant)} €/mois</strong><br><small>Estimation indicative — résultat exact sur <a href="https://www.mesdroitssociaux.gouv.fr/" target="_blank" rel="noopener">Mes droits sociaux</a></small></p>`
            : `<p class="sim-ko">ℹ️ D'après vos informations, vous n'êtes probablement pas éligible.<br><small>Vérifiez sur <a href="https://www.mesdroitssociaux.gouv.fr/" target="_blank" rel="noopener">Mes droits sociaux</a></small></p>`;
        } else throw new Error();
      } catch {
        result.innerHTML = `<p class="sim-warning">⚠️ Simulation indisponible momentanément. Rendez-vous sur <a href="https://www.mesdroitssociaux.gouv.fr/" target="_blank" rel="noopener">Mes droits sociaux</a> pour simuler vos droits.</p>`;
      }

      result.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Simuler';
    });

    container.appendChild(form);
  }

  /* ── 4. LIENS PROFONDS SERVICES PUBLICS ─────────────────────────── */
  const LIENS_OFFICIELS = {
    impots: [
      { label: '📄 Déclarer mes revenus (impots.gouv.fr)', url: 'https://cfspart.impots.gouv.fr/LoginMDP' },
      { label: '💳 Payer mes impôts en ligne', url: 'https://www.impots.gouv.fr/accueil/particulier/payer-mes-impots' },
      { label: '📊 Consulter mon avis d\'imposition', url: 'https://www.impots.gouv.fr/accueil/particulier/mon-espace-particulier' }
    ],
    caf: [
      { label: '🏠 Mon espace CAF', url: 'https://www.caf.fr/allocataires/mon-espace-caf' },
      { label: '💰 Simuler mes droits CAF', url: 'https://wwwd.caf.fr/wps/portal/caffr/aidesetservices/lesservicespratiques/estimervosdroits/lesinformationssurvosressources' },
      { label: '📋 Déclarer mes ressources', url: 'https://wwwd.caf.fr/wps/portal/caffr/aidesetservices/lesservicespratiques/declarerressources' }
    ],
    ameli: [
      { label: '🏥 Mon espace Ameli', url: 'https://assure.ameli.fr/PortailAS/appmanager/PortailAS/assure' },
      { label: '📅 Prendre un rendez-vous médecin', url: 'https://www.doctolib.fr' },
      { label: '📄 Télécharger attestation droits', url: 'https://assure.ameli.fr/PortailAS/appmanager/PortailAS/assure?_somtc=true' }
    ],
    mdph: [
      { label: '📋 Formulaire MDPH en ligne', url: 'https://www.service-public.fr/particuliers/vosdroits/R19993' },
      { label: '📞 Trouver ma MDPH', url: 'https://www.mdph.fr/index.php/annuaire-des-mdph' },
      { label: '🔍 Suivre mon dossier', url: 'https://www.mdph.fr/index.php/espaces-numeriques' }
    ],
    aah: [
      { label: '📋 Demander l\'AAH (formulaire CERFA 13750)', url: 'https://www.formulaires.service-public.fr/gf/cerfa_13750.do' },
      { label: '🔢 Simuler l\'AAH', url: 'https://www.mesdroitssociaux.gouv.fr/age/mes-droits-a-la-retraite' },
      { label: '📖 Tout savoir sur l\'AAH', url: 'https://www.service-public.fr/particuliers/vosdroits/F12242' }
    ],
    france_travail: [
      { label: '🔄 Actualiser ma situation', url: 'https://candidat.francetravail.fr/espacecandidat/actualisationinscription' },
      { label: '💼 Mes offres d\'emploi', url: 'https://candidat.francetravail.fr/offres/recherche' },
      { label: '📅 Prendre rendez-vous conseiller', url: 'https://candidat.francetravail.fr/espacecandidat/agences' }
    ],
    carte_grise: [
      { label: '🚗 Immatriculer mon véhicule (ANTS)', url: 'https://immatriculation.ants.gouv.fr/' },
      { label: '🔄 Changer le titulaire (vente/achat)', url: 'https://immatriculation.ants.gouv.fr/vos-demarches/vendre-un-vehicule' },
      { label: '📅 Prendre RDV préfecture', url: 'https://www.rdv-prefecture.interieur.gouv.fr/' }
    ],
    logement: [
      { label: '🏠 Demande logement social (numéro unique)', url: 'https://www.demande-logement-social.gouv.fr/' },
      { label: '💰 Simuler mes aides logement', url: 'https://wwwd.caf.fr/wps/portal/caffr/aidesetservices/lesservicespratiques/estimervosdroits/lesinformationssurvosressources' },
      { label: '📋 Mes droits au logement', url: 'https://www.service-public.fr/particuliers/vosdroits/N319' }
    ],
    retraite: [
      { label: '📊 Mon relevé de carrière (CNAV)', url: 'https://www.info-retraite.fr/' },
      { label: '🔢 Simuler ma retraite', url: 'https://www.info-retraite.fr/portail-services/login' },
      { label: '📋 Demande de retraite', url: 'https://www.service-public.fr/particuliers/vosdroits/F2749' }
    ],
    facturation: [
      { label: '🏢 Portail Chorus Pro (factures état)', url: 'https://chorus-pro.gouv.fr/' },
      { label: '📖 Guide PDP 2026', url: 'https://www.economie.gouv.fr/dgfip/facture-electronique' },
      { label: '🔍 Liste PDP habilitées', url: 'https://www.impots.gouv.fr/professionnel/actualites/la-reforme-de-la-facture-electronique' }
    ]
  };

  function buildLiensOfficiels(container, type) {
    if (!container || !LIENS_OFFICIELS[type]) return;
    const liens = LIENS_OFFICIELS[type];
    const section = document.createElement('div');
    section.className = 'liens-officiels';
    section.innerHTML = `<h3>Accès directs officiels</h3><ul class="liens-list">${liens.map(l => `<li><a href="${l.url}" target="_blank" rel="noopener noreferrer" class="lien-officiel">${l.label} <span aria-hidden="true">↗</span><span class="sr-only">(ouvre dans un nouvel onglet)</span></a></li>`).join('')}</ul>`;
    container.appendChild(section);
  }

  /* ── 5. INIT GLOBALE ─────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    // Adresse autocomplete
    document.querySelectorAll('[data-ban-autocomplete]').forEach(el => initAdresseAutocomplete(el));

    // Code postal → commune
    const cp = document.querySelector('[data-ban-cp]');
    const comm = document.querySelector('[data-ban-commune]');
    if (cp && comm) initCommuneAutocomplete(cp, comm);

    // Simulateurs
    document.querySelectorAll('[data-simulateur]').forEach(el => {
      buildSimulateur(el, el.dataset.simulateur);
    });

    // Liens officiels
    document.querySelectorAll('[data-liens]').forEach(el => {
      buildLiensOfficiels(el, el.dataset.liens);
    });
  });

  window.PassCerfa = { initAdresseAutocomplete, buildSimulateur, buildLiensOfficiels };
})();
