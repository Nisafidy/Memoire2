/**
 * Moteur de Schématique Solaire - results.js
 * Version PRO - Unifiée et corrigée
 * 
 * Caractéristiques:
 * - 3 zones logiques (Génération, Collecteur Bus, Stockage & Conversion)
 * - Routage Manhattan (pas de lignes diagonales)
 * - Animations proportionnelles à la puissance
 * - Responsive viewBox
 * - Gestion unifiée des données
 */

class SolarSchematic {
    constructor(svgId) {
        this.svgElement = document.getElementById(svgId);
        if (!this.svgElement) {
            console.error(`❌ SVG element '${svgId}' not found`);
            return;
        }
        
        this.svg = this.svgElement;
        this.svg.setAttribute('viewBox', '0 0 1200 800');
        this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        
        this.width = 1200;
        this.height = 800;
        this.nightCheckInterval = null;
        
        // Configuration par défaut
        this.config = {
            system_voltage: 48,
            panels: {
                total_count: 8,
                series_count: 2,
                parallel_strings: 4,
                unit_power: 400
            },
            battery: {
                soc: 75,
                capacity_kwh: 10,
                voltage: 48
            },
            status: 'production',
            power_w: 3000,
            isNight: false
        };
        
        this.init();
    }
    
    init() {
        // Nettoyer
        this.svg.innerHTML = '';
        
        // Background
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('width', this.width);
        bg.setAttribute('height', this.height);
        bg.setAttribute('fill', '#f8fafc');
        this.svg.appendChild(bg);
        
        // Zone labels
        this.addZoneLabels();
    }
    
    /**
     * Nettoyage des ressources (setInterval)
     */
    destroy() {
        if (this.nightCheckInterval) {
            clearInterval(this.nightCheckInterval);
            this.nightCheckInterval = null;
        }
    }
    
    addZoneLabels() {
        const zones = [
            { y: 120, text: '⚡ ZONE 1: GÉNÉRATION (Panneaux Solaires)', color: '#3b82f6' },
            { y: 420, text: '🔗 ZONE 2: COLLECTEUR (Bus DC)', color: '#d97706' },
            { y: 550, text: '🔋 ZONE 3: STOCKAGE & CONVERSION', color: '#10b981' }
        ];
        
        zones.forEach(zone => {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', 30);
            text.setAttribute('y', zone.y);
            text.setAttribute('font-size', '13');
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('fill', zone.color);
            text.textContent = zone.text;
            this.svg.appendChild(text);
            
            // Ligne séparatrice
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', 30);
            line.setAttribute('x2', this.width - 30);
            line.setAttribute('y1', zone.y + 10);
            line.setAttribute('y2', zone.y + 10);
            line.setAttribute('stroke', '#e2e8f0');
            line.setAttribute('stroke-width', '1');
            this.svg.appendChild(line);
        });
    }
    
    /**
     * Calcule la disposition optimale des panneaux
     */
    calculateLayout(panelCount) {
        // Trouver la disposition la plus équilibrée (proche d'un carré)
        let bestCols = 1;
        let bestRows = panelCount;
        
        for (let cols = 1; cols <= Math.sqrt(panelCount); cols++) {
            const rows = Math.ceil(panelCount / cols);
            if (Math.abs(cols - rows) < Math.abs(bestCols - bestRows)) {
                bestCols = cols;
                bestRows = rows;
            }
        }
        
        return {
            cols: bestCols,
            rows: bestRows,
            panelW: 45,
            panelH: 70,
            spacingX: 10,
            spacingY: 15,
            stringSpacing: 100
        };
    }
    
    drawPanel(x, y, w, h, label, isNight = false) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(${x}, ${y})`);
        
        const panelColor = isNight ? '#1e293b' : '#1e3a5f';
        const strokeColor = isNight ? '#475569' : '#3b82f6';
        
        // Cadre
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('rx', '4');
        rect.setAttribute('fill', panelColor);
        rect.setAttribute('stroke', strokeColor);
        rect.setAttribute('stroke-width', '2');
        g.appendChild(rect);
        
        // Grille de cellules (4x6)
        const cols = 4;
        const rows = 6;
        const cellW = (w - 8) / cols;
        const cellH = (h - 8) / rows;
        
        for(let i = 0; i < cols; i++) {
            for(let j = 0; j < rows; j++) {
                const cell = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                cell.setAttribute('x', 4 + i * cellW);
                cell.setAttribute('y', 4 + j * cellH);
                cell.setAttribute('width', cellW - 1);
                cell.setAttribute('height', cellH - 1);
                cell.setAttribute('rx', '1');
                cell.setAttribute('fill', '#2563eb');
                cell.setAttribute('opacity', '0.6');
                g.appendChild(cell);
            }
        }
        
        // Étiquette
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', w/2);
        text.setAttribute('y', h/2 + 5);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '10');
        text.setAttribute('fill', '#e2e8f0');
        text.setAttribute('font-weight', 'bold');
        text.textContent = label;
        g.appendChild(text);
        
        // Points de connexion
        const points = [[0, h/2], [w, h/2], [w/2, 0], [w/2, h]];
        points.forEach(([px, py]) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', px);
            circle.setAttribute('cy', py);
            circle.setAttribute('r', '4');
            circle.setAttribute('fill', '#10b981');
            g.appendChild(circle);
        });
        
        this.svg.appendChild(g);
        return { x, y, w, h };
    }
    
    drawPowerLine(x1, y1, x2, y2, power, maxPower = 5000) {
        const intensity = Math.min(1, Math.max(0.1, power / maxPower));
        const strokeWidth = 2 + intensity * 5;
        const dashLength = 6 + intensity * 6;
        const duration = Math.max(0.5, 2 / intensity);
        
        // Chemin Manhattan (L puis descente)
        const midX = (x1 + x2) / 2;
        const d = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', '#f59e0b');
        path.setAttribute('stroke-width', strokeWidth);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-dasharray', `${dashLength} ${dashLength}`);
        path.setAttribute('opacity', intensity * 0.8);
        
        // Animation du flux
        const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
        animate.setAttribute('attributeName', 'stroke-dashoffset');
        animate.setAttribute('from', '0');
        animate.setAttribute('to', dashLength * 2);
        animate.setAttribute('dur', `${duration}s`);
        animate.setAttribute('repeatCount', 'indefinite');
        path.appendChild(animate);
        
        this.svg.appendChild(path);
        
        // Étiquette puissance
        const labelY = (y1 + y2) / 2;
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', midX);
        text.setAttribute('y', labelY - 10);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '10');
        text.setAttribute('fill', '#f59e0b');
        text.setAttribute('font-weight', 'bold');
        text.textContent = power > 1000 ? `${(power/1000).toFixed(1)} kW` : `${Math.round(power)} W`;
        this.svg.appendChild(text);
    }
    
    drawBattery(x, y, w, h, soc, isNight = false) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(${x}, ${y})`);
        
        // Boîtier
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('rx', '4');
        rect.setAttribute('fill', isNight ? '#1f2937' : '#f3f4f6');
        rect.setAttribute('stroke', '#10b981');
        rect.setAttribute('stroke-width', '2');
        g.appendChild(rect);
        
        // Niveau de charge
        const fill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        fill.setAttribute('width', w * Math.min(1, Math.max(0, soc / 100)));
        fill.setAttribute('height', h);
        fill.setAttribute('rx', '4');
        fill.setAttribute('fill', soc > 50 ? '#10b981' : '#ef4444');
        fill.setAttribute('opacity', '0.7');
        g.appendChild(fill);
        
        // Texte SOC
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', w/2);
        text.setAttribute('y', h/2 + 5);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '14');
        text.setAttribute('fill', 'white');
        text.setAttribute('font-weight', 'bold');
        text.textContent = `${Math.round(soc)}%`;
        g.appendChild(text);
        
        // Étiquette
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', w/2);
        label.setAttribute('y', h + 18);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '9');
        label.setAttribute('fill', '#64748b');
        label.setAttribute('font-weight', 'bold');
        label.textContent = 'BATTERIE';
        g.appendChild(label);
        
        this.svg.appendChild(g);
    }
    
    drawInverter(x, y, w, h, isNight = false, powerW = 3000) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(${x}, ${y})`);
        
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('rx', '4');
        rect.setAttribute('fill', isNight ? '#334155' : '#f3f4f6');
        rect.setAttribute('stroke', '#d97706');
        rect.setAttribute('stroke-width', '2');
        g.appendChild(rect);
        
        // Onde sinusoïdale stylisée
        const wave = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const amplitude = Math.min(15, 10 + powerW / 500);
        wave.setAttribute('d', `M 10 ${h/2} Q 20 ${h/2 - amplitude} 30 ${h/2} T 50 ${h/2} T 70 ${h/2}`);
        wave.setAttribute('stroke', '#10b981');
        wave.setAttribute('stroke-width', '2');
        wave.setAttribute('fill', 'none');
        g.appendChild(wave);
        
        // LED indicatrice
        const led = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        led.setAttribute('cx', w - 12);
        led.setAttribute('cy', 12);
        led.setAttribute('r', '4');
        led.setAttribute('fill', powerW > 0 ? '#10b981' : '#ef4444');
        g.appendChild(led);
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', w/2);
        text.setAttribute('y', h + 18);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '9');
        text.setAttribute('fill', '#64748b');
        text.setAttribute('font-weight', 'bold');
        text.textContent = 'ONDULEUR';
        g.appendChild(text);
        
        this.svg.appendChild(g);
    }
    
    renderWithData(systemData = {}) {
        // Fusionner avec la configuration existante
        this.config = { ...this.config, ...systemData };
        
        const { panels, battery, power_w, system_voltage } = this.config;
        const { total_count, unit_power } = panels;
        const isNight = this.config.isNight || false;
        
        // Calculer la disposition intelligente
        const layout = this.calculateLayout(total_count || 8);
        const cols = layout.cols;
        const rows = layout.rows;
        const panelW = layout.panelW;
        const panelH = layout.panelH;
        
        // Calculer les positions
        const totalWidth = cols * (panelW + layout.spacingX) - layout.spacingX;
        const startX = (this.width - totalWidth) / 2;
        const startY = 60;
        
        const parallel_strings = cols;
        const series_count = rows;
        
        // Mettre à jour les valeurs calculées
        this.config.panels.series_count = series_count;
        this.config.panels.parallel_strings = parallel_strings;
        
        // === ZONE 1: PANNEAUX ===
        for (let col = 0; col < cols; col++) {
            const stringX = startX + col * (panelW + layout.spacingX);
            
            // Boîte String
            const box = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            box.setAttribute('x', stringX - 25);
            box.setAttribute('y', startY - 30);
            box.setAttribute('width', panelW + 50);
            box.setAttribute('height', rows * (panelH + layout.spacingY) + 40);
            box.setAttribute('rx', '5');
            box.setAttribute('fill', 'none');
            box.setAttribute('stroke', '#cbd5e1');
            box.setAttribute('stroke-width', '1.5');
            box.setAttribute('stroke-dasharray', '4 4');
            this.svg.appendChild(box);
            
            const stringLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            stringLabel.setAttribute('x', stringX + panelW/2);
            stringLabel.setAttribute('y', startY - 15);
            stringLabel.setAttribute('text-anchor', 'middle');
            stringLabel.setAttribute('font-size', '9');
            stringLabel.setAttribute('fill', '#64748b');
            stringLabel.textContent = `String ${col + 1}`;
            this.svg.appendChild(stringLabel);
            
            for (let row = 0; row < rows; row++) {
                const panelIndex = col * rows + row;
                if (panelIndex >= total_count) break;
                
                const panelX = stringX;
                const panelYpos = startY + row * (panelH + layout.spacingY);
                this.drawPanel(panelX, panelYpos, panelW, panelH, `${unit_power}W`, isNight);
                
                // Connexion série entre panneaux
                if (row > 0) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', stringX + panelW/2);
                    line.setAttribute('y1', startY + (row-1) * (panelH + layout.spacingY) + panelH);
                    line.setAttribute('x2', stringX + panelW/2);
                    line.setAttribute('y2', panelYpos);
                    line.setAttribute('stroke', '#10b981');
                    line.setAttribute('stroke-width', '3');
                    this.svg.appendChild(line);
                }
            }
        }
        
        // === ZONE 2: COLLECTEUR ===
        const lastRowY = startY + rows * (panelH + layout.spacingY);
        const collectorY = lastRowY + 60;
        
        const busWidth = cols * (panelW + layout.spacingX) + 50;
        const busX = startX - 25;
        
        const busbar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        busbar.setAttribute('x', busX);
        busbar.setAttribute('y', collectorY);
        busbar.setAttribute('width', busWidth);
        busbar.setAttribute('height', 10);
        busbar.setAttribute('rx', '3');
        busbar.setAttribute('fill', '#d97706');
        busbar.setAttribute('stroke', '#92400e');
        busbar.setAttribute('stroke-width', '2');
        this.svg.appendChild(busbar);
        
        const busLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        busLabel.setAttribute('x', this.width / 2);
        busLabel.setAttribute('y', collectorY + 25);
        busLabel.setAttribute('text-anchor', 'middle');
        busLabel.setAttribute('font-size', '10');
        busLabel.setAttribute('fill', '#d97706');
        busLabel.setAttribute('font-weight', 'bold');
        busLabel.textContent = `BUS DC - ${system_voltage}V (${(total_count * unit_power / 1000).toFixed(1)} kWc)`;
        this.svg.appendChild(busLabel);
        
        // Connexions panneaux → collecteur
        for (let col = 0; col < cols; col++) {
            const stringX = startX + col * (panelW + layout.spacingX) + panelW/2;
            const lastPanelY = startY + (rows - 1) * (panelH + layout.spacingY) + panelH;
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', stringX);
            line.setAttribute('y1', lastPanelY + 5);
            line.setAttribute('x2', stringX);
            line.setAttribute('y2', collectorY);
            line.setAttribute('stroke', '#f59e0b');
            line.setAttribute('stroke-width', '4');
            this.svg.appendChild(line);
        }
        
        // === ZONE 3: BATTERIE & ONDULEUR ===
        const storageY = collectorY + 80;
        const centerX = this.width / 2;
        
        this.drawBattery(centerX - 160, storageY, 90, 100, battery.soc, isNight);
        this.drawInverter(centerX + 70, storageY, 90, 70, isNight, power_w);
        
        // Lignes de puissance
        const totalPower = total_count * unit_power;
        this.drawPowerLine(centerX, collectorY + 10, centerX - 115, storageY + 50, power_w, totalPower);
        this.drawPowerLine(centerX, collectorY + 10, centerX + 115, storageY + 35, power_w, totalPower);
        
        // === FLUX MAISON ===
        const houseX = this.width - 100;
        const houseY = storageY + 35;
        
        const houseIcon = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        houseIcon.setAttribute('transform', `translate(${houseX}, ${houseY - 30})`);
        
        const houseRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        houseRect.setAttribute('width', 40);
        houseRect.setAttribute('height', 35);
        houseRect.setAttribute('fill', '#fbbf24');
        houseRect.setAttribute('stroke', '#d97706');
        houseRect.setAttribute('stroke-width', '2');
        houseRect.setAttribute('rx', '3');
        houseIcon.appendChild(houseRect);
        
        const roof = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        roof.setAttribute('points', '-5,0 20,-20 45,0');
        roof.setAttribute('fill', '#ef4444');
        houseIcon.appendChild(roof);
        
        const chimney = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        chimney.setAttribute('x', 30);
        chimney.setAttribute('y', -15);
        chimney.setAttribute('width', 8);
        chimney.setAttribute('height', 15);
        chimney.setAttribute('fill', '#92400e');
        houseIcon.appendChild(chimney);
        
        this.svg.appendChild(houseIcon);
        
        const houseLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        houseLabel.setAttribute('x', houseX + 20);
        houseLabel.setAttribute('y', houseY + 20);
        houseLabel.setAttribute('text-anchor', 'middle');
        houseLabel.setAttribute('font-size', '9');
        houseLabel.setAttribute('fill', '#64748b');
        houseLabel.textContent = 'MAISON';
        this.svg.appendChild(houseLabel);
        
        this.drawPowerLine(centerX + 115, storageY + 35, houseX, houseY, power_w * 0.8, totalPower);
        
        // === INDICATEUR MODE NUIT ===
        if (isNight) {
            const nightOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            nightOverlay.setAttribute('width', this.width);
            nightOverlay.setAttribute('height', this.height);
            nightOverlay.setAttribute('fill', '#0f172a');
            nightOverlay.setAttribute('opacity', '0.3');
            nightOverlay.setAttribute('pointer-events', 'none');
            this.svg.appendChild(nightOverlay);
            
            const nightText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            nightText.setAttribute('x', this.width - 200);
            nightText.setAttribute('y', 30);
            nightText.setAttribute('fill', '#94a3b8');
            nightText.setAttribute('font-size', '12');
            nightText.setAttribute('font-weight', 'bold');
            nightText.textContent = '🌙 MODE NUIT - Flux batterie → maison';
            this.svg.appendChild(nightText);
        }
        
        // === LÉGENDE ===
        this.addLegend();
    }
    
    addLegend() {
        const legendY = this.height - 70;
        
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('x', 30);
        bg.setAttribute('y', legendY);
        bg.setAttribute('width', 340);
        bg.setAttribute('height', 55);
        bg.setAttribute('rx', '6');
        bg.setAttribute('fill', 'white');
        bg.setAttribute('stroke', '#e2e8f0');
        bg.setAttribute('stroke-width', '1');
        this.svg.appendChild(bg);
        
        const items = [
            { color: '#10b981', text: '⚡ Connexions série/câblage DC', y: legendY + 18 },
            { color: '#f59e0b', text: '🔌 Flux d\'énergie actif (animé)', y: legendY + 33 },
            { color: '#3b82f6', text: '📦 Panneau solaire (400W standard)', y: legendY + 48 }
        ];
        
        items.forEach(item => {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', 45);
            rect.setAttribute('y', item.y - 8);
            rect.setAttribute('width', 14);
            rect.setAttribute('height', 10);
            rect.setAttribute('rx', '2');
            rect.setAttribute('fill', item.color);
            this.svg.appendChild(rect);
            
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', 68);
            text.setAttribute('y', item.y);
            text.setAttribute('font-size', '10');
            text.setAttribute('fill', '#475569');
            text.textContent = item.text;
            this.svg.appendChild(text);
        });
    }
}

/**
 * Point d'entrée unique pour l'initialisation du schéma
 * Utilisé par results.html
 */
function initializeSchematic(systemData = {}) {
    // Nettoyer l'instance existante si présente
    if (window._schematicInstance) {
        window._schematicInstance.destroy();
    }
    
    const schematic = new SolarSchematic('installation-svg');
    schematic.renderWithData(systemData);
    window._schematicInstance = schematic;
    
    return schematic;
}

/**
 * Fonction principale d'affichage des résultats
 * Récupère les données depuis sessionStorage
 */
function displayResults() {
    try {
        // Source de données UNIFIÉE : 'recommendation' (comme dans results.html)
        let recommendationData = null;
        
        // Essayer d'abord 'recommendation' (créé par results.html)
        const stored = sessionStorage.getItem('recommendation');
        if (stored) {
            try {
                recommendationData = JSON.parse(stored);
                console.log('✅ Données chargées depuis sessionStorage["recommendation"]');
            } catch(e) {
                console.warn('Erreur parsing recommendation:', e);
            }
        }
        
        // Fallback: 'recommendationResults' (pour compatibilité)
        if (!recommendationData) {
            const fallbackStored = sessionStorage.getItem('recommendationResults');
            if (fallbackStored) {
                try {
                    recommendationData = JSON.parse(fallbackStored);
                    console.log('⚠️ Données chargées depuis fallback recommendationResults');
                } catch(e) {
                    console.warn('Erreur parsing recommendationResults:', e);
                }
            }
        }
        
        // Fallback final: données par défaut
        if (!recommendationData) {
            recommendationData = {
                apiResults: {
                    dimensionnement: {
                        nb_panneaux: 8,
                        puissance_crête_kwc: 3.2,
                        batterie_kwh: 10
                    },
                    consommation: {
                        min_kwh: 150,
                        centre_kwh: 240,
                        max_kwh: 320
                    },
                    localisation: {
                        ville_proche: 'Antananarivo'
                    }
                },
                nbPersonnes: 4
            };
            console.log('ℹ️ Utilisation données par défaut');
        }
        
        // Extraire les données avec gestion des chemins différents
        const r = recommendationData.apiResults || recommendationData;
        const dim = r.dimensionnement || recommendationData.panels || {};
        const justif = r.justifications || r.dimensionnement?.justifications || {};
        
        // Afficher les infos texte
        const locationInfo = document.getElementById('location-info');
        if (locationInfo) {
            locationInfo.innerHTML = `📍 ${r.localisation?.ville_proche || recommendationData.location?.city || 'Madagascar'}`;
        }
        
        const personalizedMsg = document.getElementById('personalized-message');
        if (personalizedMsg) {
            const nbPersonnes = recommendationData.nbPersonnes || 1;
            const consoCentre = r.consommation?.centre_kwh || recommendationData.consumption?.central || 240;
            personalizedMsg.innerHTML = `<p>Pour <strong>${nbPersonnes} personne(s)</strong> - ${consoCentre} kWh/mois</p>`;
        }
        
        // Panneaux
        const numPanels = dim.nb_panneaux || recommendationData.panels?.total_count || 8;
        const powerKwc = dim.puissance_crête_kwc || (numPanels * 0.4) || 3.2;
        const batteryKwh = dim.batterie_kwh || recommendationData.battery?.capacity_kwh || 10;
        
        const numPanelsEl = document.getElementById('num-panels');
        if (numPanelsEl) numPanelsEl.textContent = numPanels;
        
        // AFFICHER JUSTIFICATIONS PANNEAUX
        const justifPanneaux = document.getElementById('justif-panneaux');
        if (justifPanneaux) {
            justifPanneaux.textContent = justif.panneaux || `${numPanels} × 450W = ${powerKwc} kW`;
        }
        
        const totalPowerEl = document.getElementById('total-power');
        if (totalPowerEl) totalPowerEl.textContent = powerKwc + " kW";
        
        const batteryCapacityEl = document.getElementById('battery-capacity');
        if (batteryCapacityEl) batteryCapacityEl.textContent = batteryKwh + " kWh";
        
        // AFFICHER JUSTIFICATIONS BATTERIE
        const justifBatterie = document.getElementById('justif-batterie');
        if (justifBatterie) {
            justifBatterie.textContent = justif.batterie || `Autonomie ${r.dimensionnement?.autonomie_jours || 2}j`;
        }
        
        // AFFICHER SECTION DE CALCULS DÉTAILLÉS
        const sizingPanels = document.getElementById('sizing-panels');
        if (sizingPanels) {
            const calc = r.dimensionnement?.calculs_detailles || {};
            sizingPanels.innerHTML = `
                <div>Consommation: ${calc.conso_jour || '?'} kWh/jour</div>
                <div>Irradiation: ${calc.irradiation_jour || '?'} kWh/m²/jour</div>
                <div>Rendement système: ${calc.pertes_systeme_pct || '75'}%</div>
                <div style="margin-top:5px;border-top:1px solid #e5e7eb;padding-top:5px;">
                    <strong>Formule:</strong> P = E/(I×η)<br/>
                    = ${calc.conso_jour || '?'} / (${calc.irradiation_jour || '?'} × ${(parseFloat(calc.pertes_systeme_pct||75)/100).toFixed(2)})<br/>
                    = <strong>${numPanels} panneaux</strong>
                </div>
            `;
        }
        
        const sizingBattery = document.getElementById('sizing-battery');
        if (sizingBattery) {
            const calc = r.dimensionnement?.calculs_detailles || {};
            const autonomieJours = r.dimensionnement?.autonomie_jours || 2;
            sizingBattery.innerHTML = `
                <div>Autonomie: ${autonomieJours} jour(s)</div>
                <div>Raison: ${r.dimensionnement?.justifications?.battery?.split('(')[1]?.replace(')','') || 'standard'}</div>
                <div>Profondeur décharge: ${calc.profondeur_decharge ? (calc.profondeur_decharge*100).toFixed(0) : 80}%</div>
                <div style="margin-top:5px;border-top:1px solid #e5e7eb;padding-top:5px;">
                    <strong>Formule:</strong> E = (C×A)/DoD<br/>
                    = (${calc.conso_jour || '?'} × ${autonomieJours}) / ${calc.profondeur_decharge || 0.8}<br/>
                    = <strong>${batteryKwh} kWh</strong>
                </div>
            `;
        }
        
        // Consommation
        const conso = r.consommation || recommendationData.consumption || {};
        const minConsoEl = document.getElementById('consumption-min');
        if (minConsoEl) minConsoEl.textContent = Math.round(conso.min_kwh || conso.min || 0);
        
        const centreConsoEl = document.getElementById('consumption-centre');
        if (centreConsoEl) centreConsoEl.textContent = Math.round(conso.centre_kwh || conso.central || 0);
        
        const maxConsoEl = document.getElementById('consumption-max');
        if (maxConsoEl) maxConsoEl.textContent = Math.round(conso.max_kwh || conso.max || 0);
        
        // Déterminer mode nuit
        const hour = new Date().getHours();
        const isNight = hour < 6 || hour > 18;
        
        // Préparer les données pour le schéma
        const unitPower = Math.round((powerKwc * 1000) / numPanels);
        const systemData = {
            system_voltage: 48,
            panels: {
                total_count: numPanels,
                unit_power: unitPower,
                series_count: Math.ceil(numPanels / Math.max(1, Math.floor(Math.sqrt(numPanels)))),
                parallel_strings: Math.floor(Math.sqrt(numPanels))
            },
            battery: {
                soc: 75,
                capacity_kwh: batteryKwh,
                voltage: 48
            },
            power_w: powerKwc * 1000,
            isNight: isNight
        };
        
        // Rendre le schéma
        if (typeof initializeSchematic === 'function') {
            initializeSchematic(systemData);
        } else {
            console.error('❌ initializeSchematic non défini');
        }
        
        // Mise à jour périodique du mode nuit
        if (window._nightCheckInterval) {
            clearInterval(window._nightCheckInterval);
        }
        
        window._nightCheckInterval = setInterval(() => {
            const newHour = new Date().getHours();
            const newIsNight = newHour < 6 || newHour > 18;
            if (newIsNight !== isNight && window._schematicInstance) {
                systemData.isNight = newIsNight;
                window._schematicInstance.renderWithData(systemData);
            }
        }, 60000);
        
        console.log('✅ Résultats affichés avec succès');
        
    } catch (e) {
        console.error('❌ Erreur displayResults:', e);
        // Afficher une erreur dans le SVG si possible
        const svgElement = document.getElementById('installation-svg');
        if (svgElement) {
            svgElement.innerHTML = `<text x="50%" y="50%" text-anchor="middle" fill="red" font-size="16">Erreur lors du chargement du schéma: ${e.message}</text>`;
        }
    }
}

/**
 * Navigation - compatible avec results.html
 */
function goBack() { 
    window.history.back(); 
}

function startOver() { 
    sessionStorage.clear(); 
    window.location.href = '/map-selection.html'; 
}

// Initialisation automatique si le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    displayResults();
});

// Nettoyage avant déchargement
window.addEventListener('beforeunload', () => {
    if (window._nightCheckInterval) {
        clearInterval(window._nightCheckInterval);
    }
    if (window._schematicInstance) {
        window._schematicInstance.destroy();
    }
});

// Export pour utilisation externe (compatible avec les modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SolarSchematic, initializeSchematic, displayResults };
}