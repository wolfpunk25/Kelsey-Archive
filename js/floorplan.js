// Renders a zone's floor plan as an SVG, and can highlight one bay on it
// with a callout label, matching the look of the archive's paper plan.

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(name, attrs, children) {
  const node = document.createElementNS(SVG_NS, name);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  (children || []).forEach(c => node.appendChild(c));
  return node;
}

function renderZonePlan(container, zoneId, highlight) {
  const zone = ZONES[zoneId];
  container.innerHTML = '';
  if (!zone) {
    container.innerHTML = '<p class="plan-empty">No plan available for this zone yet.</p>';
    return;
  }

  const svg = el('svg', {
    viewBox: zone.viewBox,
    class: 'zone-plan',
    role: 'img',
    'aria-label': `Floor plan for ${zone.name}`
  });

  // Zone label tag, top-left
  const lb = zone.labelBox;
  svg.appendChild(el('rect', { x: lb.x, y: lb.y, width: lb.w, height: lb.h, fill: 'var(--plan-zone-tag)', rx: 2 }));
  const zoneText = el('text', {
    x: lb.x + lb.w / 2, y: lb.y + lb.h / 2,
    fill: '#fff', 'font-size': 15, 'font-weight': 700,
    'text-anchor': 'middle', 'dominant-baseline': 'central'
  });
  zoneText.textContent = zone.name;
  svg.appendChild(zoneText);

  // Decorative (non-interactive) elements, e.g. corridor/gap markers
  (zone.decorative || []).forEach(d => {
    svg.appendChild(el('rect', {
      x: d.x, y: d.y, width: d.w, height: d.h,
      fill: 'var(--plan-decorative)'
    }));
  });

  const isHighlighted = (aisleId, bayId) =>
    highlight && highlight.aisle === aisleId && highlight.bay === bayId;

  let highlightGroup = null;

  zone.aisles.forEach(aisle => {
    aisle.bays.forEach(bay => {
      const hit = isHighlighted(aisle.id, bay.bay);
      const g = el('g', {
        class: 'bay' + (hit ? ' bay-highlight' : ''),
        'data-aisle': aisle.id,
        'data-bay': bay.bay
      });
      g.appendChild(el('rect', {
        x: bay.x, y: bay.y, width: bay.w, height: bay.h,
        fill: hit ? 'var(--plan-highlight)' : 'var(--plan-bay-fill)',
        stroke: 'var(--plan-bay-stroke)', 'stroke-width': 1.4
      }));
      const cx = bay.x + bay.w / 2;
      const cy = bay.y + bay.h / 2;
      const textAttrs = {
        x: cx, y: cy,
        fill: 'var(--plan-bay-text)', 'font-size': 12, 'font-weight': 700,
        'text-anchor': 'middle', 'dominant-baseline': 'central'
      };
      if (bay.vertical) textAttrs.transform = `rotate(-90 ${cx} ${cy})`;
      const t = el('text', textAttrs);
      t.textContent = bay.bay;
      g.appendChild(t);
      svg.appendChild(g);
      if (hit) highlightGroup = { g, bay, cx, cy };
    });

    const lt = el('text', {
      x: aisle.label.x, y: aisle.label.y,
      fill: 'var(--plan-aisle-label)', 'font-size': 13, 'font-weight': 700,
      'text-anchor': 'middle', 'dominant-baseline': 'central'
    });
    lt.textContent = aisle.id;
    svg.appendChild(lt);
  });

  // Callout label for the highlighted bay, e.g. "C-04-02-A"
  if (highlightGroup && highlight.locationLabel) {
    const { bay } = highlightGroup;
    const labelText = highlight.locationLabel;
    const approxWidth = Math.max(58, labelText.length * 9 + 16);
    const lx = bay.x + bay.w / 2 - approxWidth / 2;
    const ly = bay.y - 26;
    const callout = el('g', { class: 'bay-callout' });
    callout.appendChild(el('rect', {
      x: lx, y: ly, width: approxWidth, height: 22, rx: 6,
      fill: 'var(--plan-highlight)'
    }));
    const ct = el('text', {
      x: lx + approxWidth / 2, y: ly + 11,
      fill: '#083', 'font-size': 13, 'font-weight': 700,
      'text-anchor': 'middle', 'dominant-baseline': 'central'
    });
    ct.textContent = labelText;
    callout.appendChild(ct);
    svg.appendChild(callout);
  }

  container.appendChild(svg);

  if (highlightGroup) {
    highlightGroup.g.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }
}
