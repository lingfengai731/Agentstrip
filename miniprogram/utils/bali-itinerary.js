(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WMBaliItinerary = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  function extensions(catalog, routeId) {
    return (catalog.extensions || []).filter(function (item) { return item.route_ids.indexOf(routeId) >= 0; });
  }
  function selected(catalog, routeId, ids) {
    var allowed = extensions(catalog, routeId);
    return Array.from(new Set(Array.isArray(ids) ? ids : [])).map(function (id) {
      return allowed.find(function (item) { return item.id === id; });
    }).filter(Boolean);
  }
  function extensionDay(item) {
    return { region_id:item.region_id, node_id:item.node_id, extension_id:item.id,
      theme:item.name, place_ids:item.poi_ids.slice() };
  }
  function foodCandidates(day, restaurants, filters) {
    filters = filters || {};
    return restaurants.filter(function (item) {
      if (!item.published || item.region !== day.region_id) return false;
      if (day.extension_id) {
        if ((item.extensionIds || []).indexOf(day.extension_id) < 0) return false;
      } else if ((item.node_id || '').indexOf('nusa_penida') === 0) return false;
      if (day.node_id && item.node_id !== day.node_id && !day.extension_id) return false;
      return (!filters.category || item.category === filters.category) &&
        (!filters.price || item.priceLevel === filters.price) &&
        (!filters.meal || item.suitableDayparts.indexOf(filters.meal) >= 0);
    });
  }
  function addFood(plan, dayIndex, item, meal) {
    if (!Number.isInteger(dayIndex) || !plan.days[dayIndex] || ['breakfast','lunch','dinner','brunch','dessert'].indexOf(meal) < 0) throw new Error('Select a valid day and meal');
    if (!foodCandidates(plan.days[dayIndex], [item], {meal:meal}).length) throw new Error('Restaurant does not fit this day');
    var result = JSON.parse(JSON.stringify(plan));
    var day = result.days[dayIndex];
    day.food_stops = (day.food_stops || []).filter(function (stop) { return stop.restaurant_id !== item.id; });
    day.food_stops.push({restaurant_id:item.id, meal:meal});
    if (day.food_stops.length > 3) throw new Error('Up to three restaurant stops per day');
    return result;
  }
  function diningStops(plan) {
    return plan.days.reduce(function (items, day, index) {
      return items.concat((day.food_stops || []).map(function (stop) {
        return {day:index + 1, restaurant_id:stop.restaurant_id, meal:stop.meal};
      }));
    }, []);
  }
  function candidates(day, pois, used, catalog) {
    var module = (catalog.extensions || []).find(function (item) { return item.id === day.extension_id; });
    var allowed = module ? module.poi_ids.concat(module.candidate_poi_ids || []) : null;
    var node = day.node_id || '';
    if (!node && day.region_id === 'G3') {
      var first = pois.find(function (poi) { return (day.place_ids || []).indexOf(poi.id) >= 0; });
      node = first && first.node_id || 'sanur';
    }
    return pois.filter(function (poi) {
      if (used.indexOf(poi.id) >= 0 || poi.region_id !== day.region_id) return false;
      if (poi.verification_status === 'retired') return false;
      if (allowed) return allowed.indexOf(poi.id) >= 0;
      // G3 contains a mainland gateway and two island clusters: region alone is insufficient.
      return day.region_id !== 'G3' || poi.node_id === node;
    });
  }
  function append(plan, catalog, id) {
    var selectedModules = selected(catalog, plan.route_id, (plan.extension_ids || []).concat(id));
    if (selectedModules.length > 3) throw new Error('Too many extension days');
    var base = plan.days.filter(function (day) { return !day.extension_id; });
    return { route_id:plan.route_id, extension_ids:selectedModules.map(function (item) { return item.id; }),
      days:base.concat(selectedModules.map(function (item) {
        return plan.days.find(function (day) { return day.extension_id === item.id; }) || extensionDay(item);
      })) };
  }
  function remove(plan, id) {
    return { route_id:plan.route_id, extension_ids:(plan.extension_ids || []).filter(function (value) { return value !== id; }),
      days:plan.days.filter(function (day) { return day.extension_id !== id; }) };
  }
  return { extensions:extensions, selected:selected, extensionDay:extensionDay, candidates:candidates, append:append, remove:remove,
    foodCandidates:foodCandidates, addFood:addFood, diningStops:diningStops };
});
