import Ember from 'ember-metal/core'; // A, FEATURES, assert
import { set } from "ember-metal/property_set";
import run from "ember-metal/run_loop";
import EventDispatcher from "ember-views/system/event_dispatcher";
import ActionManager from "ember-views/system/action_manager";

import { Registry } from "ember-runtime/system/container";
import EmberObject from "ember-runtime/system/object";
import { default as EmberController } from "ember-runtime/controllers/controller";
import EmberObjectController from "ember-runtime/controllers/object_controller";
import EmberArrayController from "ember-runtime/controllers/array_controller";

import compile from "ember-template-compiler/system/compile";
import EmberView from "ember-views/views/view";
import EmberComponent from "ember-views/views/component";
import jQuery from "ember-views/system/jquery";

import {
  registerHelper,
  default as helpers
} from "ember-htmlbars/helpers";

import {
  ActionHelper,
  actionHelper
} from "ember-routing-htmlbars/helpers/action";

import {
  runAppend,
  runDestroy
} from "ember-runtime/tests/utils";

var dispatcher, view, originalActionHelper;
var originalRegisterAction = ActionHelper.registerAction;

QUnit.module("ember-routing-htmlbars: action helper", {
  setup: function() {
    originalActionHelper = helpers['action'];
    registerHelper('action', actionHelper);

    dispatcher = EventDispatcher.create();
    dispatcher.setup();
  },

  teardown: function() {
    runDestroy(view);
    runDestroy(dispatcher);

    delete helpers['action'];
    helpers['action'] = originalActionHelper;

    ActionHelper.registerAction = originalRegisterAction;
  }
});

test("should output a data attribute with a guid", function() {
  view = EmberView.create({
    template: compile('<a href="#" {{action "edit"}}>edit</a>')
  });

  runAppend(view);

  ok(view.$('a').attr('data-ember-action').match(/\d+/), "A data-ember-action attribute with a guid was added");
});

test("should by default register a click event", function() {
  var registeredEventName;

  ActionHelper.registerAction = function(actionName, options) {
    registeredEventName = options.eventName;
  };

  view = EmberView.create({
    template: compile('<a href="#" {{action "edit"}}>edit</a>')
  });

  runAppend(view);

  equal(registeredEventName, 'click', "The click event was properly registered");
});

test("should allow alternative events to be handled", function() {
  var registeredEventName;

  ActionHelper.registerAction = function(actionName, options) {
    registeredEventName = options.eventName;
  };

  view = EmberView.create({
    template: compile('<a href="#" {{action "edit" on="mouseUp"}}>edit</a>')
  });

  runAppend(view);

  equal(registeredEventName, 'mouseUp', "The alternative mouseUp event was properly registered");
});

test("should by default target the view's controller", function() {
  var registeredTarget;
  var controller = {};

  ActionHelper.registerAction = function(actionName, options) {
    registeredTarget = options.target.value();
  };

  view = EmberView.create({
    controller: controller,
    template: compile('<a href="#" {{action "edit"}}>edit</a>')
  });

  runAppend(view);

  equal(registeredTarget, controller, "The controller was registered as the target");
});

test("Inside a yield, the target points at the original target", function() {
  var watted = false;

  var component = EmberComponent.extend({
    boundText: "inner",
    truthy: true,
    obj: {},
    layout: compile("<div>{{boundText}}</div><div>{{#if truthy}}{{yield}}{{/if}}</div>")
  });

  view = EmberView.create({
    controller: {
      boundText: "outer",
      truthy: true,
      wat: function() {
        watted = true;
      },
      component: component
    },
    template: compile('{{#if truthy}}{{#view component}}{{#if truthy}}<div {{action "wat"}} class="wat">{{boundText}}</div>{{/if}}{{/view}}{{/if}}')
  });

  runAppend(view);

  run(function() {
    view.$(".wat").click();
  });

  equal(watted, true, "The action was called on the right context");
});

if (!Ember.FEATURES.isEnabled('ember-htmlbars')) {
// jscs:disable validateIndentation
test("should target the current controller inside an {{each}} loop [DEPRECATED]", function() {
  var registeredTarget;

  ActionHelper.registerAction = function(actionName, options) {
    registeredTarget = options.target.value();
  };

  var itemController = EmberObjectController.create();

  var ArrayController = EmberArrayController.extend({
    itemController: 'stub',
    controllerAt: function(idx, object) {
      return itemController;
    }
  });

  var controller = ArrayController.create({
    model: Ember.A([1])
  });

  view = EmberView.create({
    controller: controller,
    template: compile('{{#each controller}}{{action "editTodo"}}{{/each}}')
  });

  expectDeprecation(function() {
    runAppend(view);
  }, 'Using the context switching form of {{each}} is deprecated. Please use the keyword form (`{{#each foo in bar}}`) instead. See http://emberjs.com/guides/deprecations/#toc_more-consistent-handlebars-scope for more details.');

  equal(registeredTarget, itemController, "the item controller is the target of action");
});
// jscs:enable validateIndentation
}

test("should target the with-controller inside an {{#with controller='person'}} [DEPRECATED]", function() {
  var registeredTarget;

  ActionHelper.registerAction = function(actionName, options) {
    registeredTarget = options.target.value();
  };

  var PersonController = EmberObjectController.extend();
  var registry = new Registry();
  var container = registry.container();
  var parentController = EmberObject.create({
    container: container
  });

  view = EmberView.create({
    container: container,
    template: compile('{{#with view.person controller="person"}}<div {{action "editTodo"}}></div>{{/with}}'),
    person: EmberObject.create(),
    controller: parentController
  });

  registry.register('controller:person', PersonController);

  expectDeprecation(function() {
    runAppend(view);
  }, 'Using the context switching form of `{{with}}` is deprecated. Please use the keyword form (`{{with foo as bar}}`) instead. See http://emberjs.com/guides/deprecations/#toc_more-consistent-handlebars-scope for more details.');

  ok(registeredTarget instanceof PersonController, "the with-controller is the target of action");
});

test("should target the with-controller inside an {{each}} in a {{#with controller='person'}} [DEPRECATED]", function() {
  expectDeprecation('Using the context switching form of {{each}} is deprecated. Please use the keyword form (`{{#each foo in bar}}`) instead. See http://emberjs.com/guides/deprecations/#toc_more-consistent-handlebars-scope for more details.');
  expectDeprecation('Using the context switching form of `{{with}}` is deprecated. Please use the keyword form (`{{with foo as bar}}`) instead. See http://emberjs.com/guides/deprecations/#toc_more-consistent-handlebars-scope for more details.');

  var eventsCalled = [];

  var PeopleController = EmberArrayController.extend({
    actions: {
      robert: function() { eventsCalled.push('robert'); },
      brian: function() { eventsCalled.push('brian'); }
    }
  });

  var registry = new Registry();
  var container = registry.container();
  var parentController = EmberObject.create({
    container: container,
    people: Ember.A([
      {name: 'robert'},
      {name: 'brian'}
    ])
  });

  view = EmberView.create({
    container: container,
    template: compile('{{#with people controller="people"}}{{#each}}<a href="#" {{action name}}>{{name}}</a>{{/each}}{{/with}}'),
    controller: parentController
  });

  registry.register('controller:people', PeopleController);

  runAppend(view);

  view.$('a').trigger('click');

  deepEqual(eventsCalled, ['robert', 'brian'], 'the events are fired properly');
});

test("should allow a target to be specified", function() {
  var registeredTarget;

  ActionHelper.registerAction = function(actionName, options) {
    registeredTarget = options.target.value();
  };

  var anotherTarget = EmberView.create();

  view = EmberView.create({
    controller: {},
    template: compile('<a href="#" {{action "edit" target=view.anotherTarget}}>edit</a>'),
    anotherTarget: anotherTarget
  });

  runAppend(view);

  equal(registeredTarget, anotherTarget, "The specified target was registered");

  runDestroy(anotherTarget);
});

test("should lazily evaluate the target", function() {
  var firstEdit = 0;
  var secondEdit = 0;
  var controller = {};
  var first = {
    edit: function() {
      firstEdit++;
    }
  };

  var second = {
    edit: function() {
      secondEdit++;
    }
  };

  controller.theTarget = first;

  view = EmberView.create({
    controller: controller,
    template: compile('<a href="#" {{action "edit" target=theTarget}}>edit</a>')
  });

  runAppend(view);

  run(function() {
    jQuery('a').trigger('click');
  });

  equal(firstEdit, 1);

  run(function() {
    set(controller, 'theTarget', second);
  });

  run(function() {
    jQuery('a').trigger('click');
  });

  equal(firstEdit, 1);
  equal(secondEdit, 1);
});

test("should register an event handler", function() {
  var eventHandlerWasCalled = false;

  var controller = EmberController.extend({
    actions: { edit: function() { eventHandlerWasCalled = true; } }
  }).create();

  view = EmberView.create({
    controller: controller,
    template: compile('<a href="#" {{action "edit"}}>click me</a>')
  });

  runAppend(view);

  var actionId = view.$('a[data-ember-action]').attr('data-ember-action');

  ok(ActionManager.registeredActions[actionId], "The action was registered");

  view.$('a').trigger('click');

  ok(eventHandlerWasCalled, "The event handler was called");
});

test("handles whitelisted modifier keys", function() {
  var eventHandlerWasCalled = false;
  var shortcutHandlerWasCalled = false;

  var controller = EmberController.extend({
    actions: {
      edit: function() { eventHandlerWasCalled = true; },
      shortcut: function() { shortcutHandlerWasCalled = true; }
    }
  }).create();

  view = EmberView.create({
    controller: controller,
    template: compile('<a href="#" {{action "edit" allowedKeys="alt"}}>click me</a> <div {{action "shortcut" allowedKeys="any"}}>click me too</div>')
  });

  runAppend(view);

  var actionId = view.$('a[data-ember-action]').attr('data-ember-action');

  ok(ActionManager.registeredActions[actionId], "The action was registered");

  var e = jQuery.Event('click');
  e.altKey = true;
  view.$('a').trigger(e);

  ok(eventHandlerWasCalled, "The event handler was called");

  e = jQuery.Event('click');
  e.ctrlKey = true;
  view.$('div').trigger(e);

  ok(shortcutHandlerWasCalled, "The \"any\" shortcut's event handler was called");
});

test("should be able to use action more than once for the same event within a view", function() {
  var editWasCalled = false;
  var deleteWasCalled = false;
  var originalEventHandlerWasCalled = false;

  var controller = EmberController.extend({
    actions: {
      edit: function() { editWasCalled = true; },
      "delete": function() { deleteWasCalled = true; }
    }
  }).create();

  view = EmberView.create({
    controller: controller,
    template: compile(
      '<a id="edit" href="#" {{action "edit"}}>edit</a><a id="delete" href="#" {{action "delete"}}>delete</a>'
    ),
    click: function() { originalEventHandlerWasCalled = true; }
  });

  runAppend(view);

  view.$('#edit').trigger('click');

  equal(editWasCalled, true, "The edit action was called");
  equal(deleteWasCalled, false, "The delete action was not called");

  editWasCalled = deleteWasCalled = originalEventHandlerWasCalled = false;

  view.$('#delete').trigger('click');

  equal(editWasCalled, false, "The edit action was not called");
  equal(deleteWasCalled, true, "The delete action was called");

  editWasCalled = deleteWasCalled = originalEventHandlerWasCalled = false;

  view.$().trigger('click');

  equal(editWasCalled, false, "The edit action was not called");
  equal(deleteWasCalled, false, "The delete action was not called");
});

test("the event should not bubble if `bubbles=false` is passed", function() {
  var editWasCalled = false;
  var deleteWasCalled = false;
  var originalEventHandlerWasCalled = false;

  var controller = EmberController.extend({
    actions: {
      edit: function() { editWasCalled = true; },
      "delete": function() { deleteWasCalled = true; }
    }
  }).create();

  view = EmberView.create({
    controller: controller,
    template: compile(
      '<a id="edit" href="#" {{action "edit" bubbles=false}}>edit</a><a id="delete" href="#" {{action "delete" bubbles=false}}>delete</a>'
    ),
    click: function() { originalEventHandlerWasCalled = true; }
  });

  runAppend(view);

  view.$('#edit').trigger('click');

  equal(editWasCalled, true, "The edit action was called");
  equal(deleteWasCalled, false, "The delete action was not called");
  equal(originalEventHandlerWasCalled, false, "The original event handler was not called");

  editWasCalled = deleteWasCalled = originalEventHandlerWasCalled = false;

  view.$('#delete').trigger('click');

  equal(editWasCalled, false, "The edit action was not called");
  equal(deleteWasCalled, true, "The delete action was called");
  equal(originalEventHandlerWasCalled, false, "The original event handler was not called");

  editWasCalled = deleteWasCalled = originalEventHandlerWasCalled = false;

  view.$().trigger('click');

  equal(editWasCalled, false, "The edit action was not called");
  equal(deleteWasCalled, false, "The delete action was not called");
  equal(originalEventHandlerWasCalled, true, "The original event handler was called");
});

test("should work properly in an #each block", function() {
  var eventHandlerWasCalled = false;

  var controller = EmberController.extend({
    actions: { edit: function() { eventHandlerWasCalled = true; } }
  }).create();

  view = EmberView.create({
    controller: controller,
    items: Ember.A([1, 2, 3, 4]),
    template: compile('{{#each item in view.items}}<a href="#" {{action "edit"}}>click me</a>{{/each}}')
  });

  runAppend(view);

  view.$('a').trigger('click');

  ok(eventHandlerWasCalled, "The event handler was called");
});

test("should work properly in a {{#with foo as bar}} block", function() {
  var eventHandlerWasCalled = false;

  var controller = EmberController.extend({
    actions: { edit: function() { eventHandlerWasCalled = true; } }
  }).create();

  view = EmberView.create({
    controller: controller,
    something: {ohai: 'there'},
    template: compile('{{#with view.something as somethingElse}}<a href="#" {{action "edit"}}>click me</a>{{/with}}')
  });

  runAppend(view);

  view.$('a').trigger('click');

  ok(eventHandlerWasCalled, "The event handler was called");
});

test("should work properly in a #with block [DEPRECATED]", function() {
  var eventHandlerWasCalled = false;

  var controller = EmberController.extend({
    actions: { edit: function() { eventHandlerWasCalled = true; } }
  }).create();

  view = EmberView.create({
    controller: controller,
    something: {ohai: 'there'},
    template: compile('{{#with view.something}}<a href="#" {{action "edit"}}>click me</a>{{/with}}')
  });

  expectDeprecation(function() {
    runAppend(view);
  }, 'Using the context switching form of `{{with}}` is deprecated. Please use the keyword form (`{{with foo as bar}}`) instead. See http://emberjs.com/guides/deprecations/#toc_more-consistent-handlebars-scope for more details.');

  view.$('a').trigger('click');

  ok(eventHandlerWasCalled, "The event handler was called");
});

test("should unregister event handlers on rerender", function() {
  var eventHandlerWasCalled = false;

  view = EmberView.extend({
    template: compile('<a href="#" {{action "edit"}}>click me</a>'),
    actions: { edit: function() { eventHandlerWasCalled = true; } }
  }).create();

  runAppend(view);

  var previousActionId = view.$('a[data-ember-action]').attr('data-ember-action');

  run(function() {
    view.rerender();
  });

  ok(!ActionManager.registeredActions[previousActionId], "On rerender, the event handler was removed");

  var newActionId = view.$('a[data-ember-action]').attr('data-ember-action');

  ok(ActionManager.registeredActions[newActionId], "After rerender completes, a new event handler was added");
});

test("should unregister event handlers on inside virtual views", function() {
  var things = Ember.A([
    {
      name: 'Thingy'
    }
  ]);
  view = EmberView.create({
    template: compile('{{#each thing in view.things}}<a href="#" {{action "edit"}}>click me</a>{{/each}}'),
    things: things
  });

  runAppend(view);

  var actionId = view.$('a[data-ember-action]').attr('data-ember-action');

  run(function() {
    things.removeAt(0);
  });

  ok(!ActionManager.registeredActions[actionId], "After the virtual view was destroyed, the action was unregistered");
});

test("should properly capture events on child elements of a container with an action", function() {
  var eventHandlerWasCalled = false;

  var controller = EmberController.extend({
    actions: { edit: function() { eventHandlerWasCalled = true; } }
  }).create();

  view = EmberView.create({
    controller: controller,
    template: compile('<div {{action "edit"}}><button>click me</button></div>')
  });

  runAppend(view);

  view.$('button').trigger('click');

  ok(eventHandlerWasCalled, "Event on a child element triggered the action of its parent");
});

test("should allow bubbling of events from action helper to original parent event", function() {
  var eventHandlerWasCalled = false;
  var originalEventHandlerWasCalled = false;

  var controller = EmberController.extend({
    actions: { edit: function() { eventHandlerWasCalled = true; } }
  }).create();

  view = EmberView.create({
    controller: controller,
    template: compile('<a href="#" {{action "edit"}}>click me</a>'),
    click: function() { originalEventHandlerWasCalled = true; }
  });

  runAppend(view);

  view.$('a').trigger('click');

  ok(eventHandlerWasCalled && originalEventHandlerWasCalled, "Both event handlers were called");
});

test("should not bubble an event from action helper to original parent event if `bubbles=false` is passed", function() {
  var eventHandlerWasCalled = false;
  var originalEventHandlerWasCalled = false;

  var controller = EmberController.extend({
    actions: { edit: function() { eventHandlerWasCalled = true; } }
  }).create();

  view = EmberView.create({
    controller: controller,
    template: compile('<a href="#" {{action "edit" bubbles=false}}>click me</a>'),
    click: function() { originalEventHandlerWasCalled = true; }
  });

  runAppend(view);

  view.$('a').trigger('click');

  ok(eventHandlerWasCalled, "The child handler was called");
  ok(!originalEventHandlerWasCalled, "The parent handler was not called");
});

test("should allow 'send' as action name (#594)", function() {
  var eventHandlerWasCalled = false;

  var controller = EmberController.extend({
    send: function() { eventHandlerWasCalled = true; }
  }).create();

  view = EmberView.create({
    controller: controller,
    template: compile('<a href="#" {{action "send" }}>send</a>')
  });

  runAppend(view);

  view.$('a').trigger('click');

  ok(eventHandlerWasCalled, "The view's send method was called");
});


test("should send the view, event and current context to the action", function() {
  var passedTarget;
  var passedContext;

  var aTarget = EmberController.extend({
    actions: {
      edit: function(context) {
        passedTarget = this;
        passedContext = context;
      }
    }
  }).create();

  var aContext = { aTarget: aTarget };

  view = EmberView.create({
    context: aContext,
    template: compile('<a id="edit" href="#" {{action "edit" this target=aTarget}}>edit</a>')
  });

  runAppend(view);

  view.$('#edit').trigger('click');

  strictEqual(passedTarget, aTarget, "the action is called with the target as this");
  strictEqual(passedContext, aContext, "the parameter is passed along");
});

test("should only trigger actions for the event they were registered on", function() {
  var editWasCalled = false;

  view = EmberView.extend({
    template: compile('<a href="#" {{action "edit"}}>edit</a>'),
    actions: { edit: function() { editWasCalled = true; } }
  }).create();

  runAppend(view);

  view.$('a').trigger('mouseover');

  ok(!editWasCalled, "The action wasn't called");
});

test("should unwrap controllers passed as a context", function() {
  var passedContext;
  var model = EmberObject.create();
  var controller = EmberObjectController.extend({
    model: model,
    actions: {
      edit: function(context) {
        passedContext = context;
      }
    }
  }).create();

  view = EmberView.create({
    controller: controller,
    template: compile('<button {{action "edit" this}}>edit</button>')
  });

  runAppend(view);

  view.$('button').trigger('click');

  equal(passedContext, model, "the action was passed the unwrapped model");
});

test("should not unwrap controllers passed as `controller`", function() {
  var passedContext;
  var model = EmberObject.create();
  var controller = EmberObjectController.extend({
    model: model,
    actions: {
      edit: function(context) {
        passedContext = context;
      }
    }
  }).create();

  view = EmberView.create({
    controller: controller,
    template: compile('<button {{action "edit" controller}}>edit</button>')
  });

  runAppend(view);

  view.$('button').trigger('click');

  equal(passedContext, controller, "the action was passed the controller");
});

test("should allow multiple contexts to be specified", function() {
  var passedContexts;
  var models = [EmberObject.create(), EmberObject.create()];

  var controller = EmberController.extend({
    actions: {
      edit: function() {
        passedContexts = [].slice.call(arguments);
      }
    }
  }).create();

  view = EmberView.create({
    controller: controller,
    modelA: models[0],
    modelB: models[1],
    template: compile('<button {{action "edit" view.modelA view.modelB}}>edit</button>')
  });

  runAppend(view);

  view.$('button').trigger('click');

  deepEqual(passedContexts, models, "the action was called with the passed contexts");
});

test("should allow multiple contexts to be specified mixed with string args", function() {
  var passedParams;
  var model = EmberObject.create();

  var controller = EmberController.extend({
    actions: {
      edit: function() {
        passedParams = [].slice.call(arguments);
      }
    }
  }).create();

  view = EmberView.create({
    controller: controller,
    modelA: model,
    template: compile('<button {{action "edit" "herp" view.modelA}}>edit</button>')
  });

  runAppend(view);

  view.$('button').trigger('click');

  deepEqual(passedParams, ["herp", model], "the action was called with the passed contexts");
});

test("it does not trigger action with special clicks", function() {
  var showCalled = false;

  view = EmberView.create({
    template: compile("<a {{action 'show' href=true}}>Hi</a>")
  });

  var controller = EmberController.extend({
    actions: {
      show: function() {
        showCalled = true;
      }
    }
  }).create();

  run(function() {
    view.set('controller', controller);
    view.appendTo('#qunit-fixture');
  });

  function checkClick(prop, value, expected) {
    var event = jQuery.Event("click");
    event[prop] = value;
    view.$('a').trigger(event);
    if (expected) {
      ok(showCalled, "should call action with "+prop+":"+value);
      ok(event.isDefaultPrevented(), "should prevent default");
    } else {
      ok(!showCalled, "should not call action with "+prop+":"+value);
      ok(!event.isDefaultPrevented(), "should not prevent default");
    }
  }

  checkClick('ctrlKey', true, false);
  checkClick('altKey', true, false);
  checkClick('metaKey', true, false);
  checkClick('shiftKey', true, false);
  checkClick('which', 2, false);

  checkClick('which', 1, true);
  checkClick('which', undefined, true); // IE <9
});

test("it can trigger actions for keyboard events", function() {
  var showCalled = false;

  view = EmberView.create({
    template: compile("<input type='text' {{action 'show' on='keyUp'}}>")
  });

  var controller = EmberController.extend({
    actions: {
      show: function() {
        showCalled = true;
      }
    }
  }).create();

  run(function() {
    view.set('controller', controller);
    view.appendTo('#qunit-fixture');
  });

  var event = jQuery.Event("keyup");
  event.char = 'a';
  event.which = 65;
  view.$('input').trigger(event);
  ok(showCalled, "should call action with keyup");
});

test("a quoteless parameter should allow dynamic lookup of the actionName", function() {
  expect(4);
  var lastAction;
  var actionOrder = [];

  view = EmberView.create({
    template: compile("<a id='woot-bound-param' {{action hookMeUp}}>Hi</a>")
  });

  var controller = EmberController.extend({
    hookMeUp: 'biggityBoom',
    actions: {
      biggityBoom: function() {
        lastAction = 'biggityBoom';
        actionOrder.push(lastAction);
      },
      whompWhomp: function() {
        lastAction = 'whompWhomp';
        actionOrder.push(lastAction);
      },
      sloopyDookie: function() {
        lastAction = 'sloopyDookie';
        actionOrder.push(lastAction);
      }
    }
  }).create();

  run(function() {
    view.set('controller', controller);
    view.appendTo('#qunit-fixture');
  });

  var testBoundAction = function(propertyValue) {
    run(function() {
      controller.set('hookMeUp', propertyValue);
    });

    run(function() {
      view.$("#woot-bound-param").click();
    });

    equal(lastAction, propertyValue, 'lastAction set to ' + propertyValue);
  };

  testBoundAction('whompWhomp');
  testBoundAction('sloopyDookie');
  testBoundAction('biggityBoom');

  deepEqual(actionOrder, ['whompWhomp', 'sloopyDookie', 'biggityBoom'], 'action name was looked up properly');
});

test("a quoteless parameter should lookup actionName in context [DEPRECATED]", function() {
  expect(5);
  var lastAction;
  var actionOrder = [];

  view = EmberView.create({
    template: compile("{{#each allactions}}<a {{bind-attr id='name'}} {{action name}}>{{title}}</a>{{/each}}")
  });

  var controller = EmberController.extend({
    allactions: Ember.A([{title: 'Biggity Boom',name: 'biggityBoom'},
                         {title: 'Whomp Whomp',name: 'whompWhomp'},
                         {title: 'Sloopy Dookie',name: 'sloopyDookie'}]),
    actions: {
      biggityBoom: function() {
        lastAction = 'biggityBoom';
        actionOrder.push(lastAction);
      },
      whompWhomp: function() {
        lastAction = 'whompWhomp';
        actionOrder.push(lastAction);
      },
      sloopyDookie: function() {
        lastAction = 'sloopyDookie';
        actionOrder.push(lastAction);
      }
    }
  }).create();

  expectDeprecation(function() {
    run(function() {
      view.set('controller', controller);
      view.appendTo('#qunit-fixture');
    });
  }, 'Using the context switching form of {{each}} is deprecated. Please use the keyword form (`{{#each foo in bar}}`) instead. See http://emberjs.com/guides/deprecations/#toc_more-consistent-handlebars-scope for more details.');

  var testBoundAction = function(propertyValue) {
    run(function() {
      view.$("#"+propertyValue).click();
    });

    equal(lastAction, propertyValue, 'lastAction set to ' + propertyValue);
  };

  testBoundAction('whompWhomp');
  testBoundAction('sloopyDookie');
  testBoundAction('biggityBoom');

  deepEqual(actionOrder, ['whompWhomp', 'sloopyDookie', 'biggityBoom'], 'action name was looked up properly');
});

test("a quoteless parameter should resolve actionName, including path", function() {
  expect(4);
  var lastAction;
  var actionOrder = [];

  view = EmberView.create({
    template: compile("{{#each item in allactions}}<a {{bind-attr id='item.name'}} {{action item.name}}>{{item.title}}</a>{{/each}}")
  });

  var controller = EmberController.extend({
    allactions: Ember.A([{title: 'Biggity Boom',name: 'biggityBoom'},
                         {title: 'Whomp Whomp',name: 'whompWhomp'},
                         {title: 'Sloopy Dookie',name: 'sloopyDookie'}]),
    actions: {
      biggityBoom: function() {
        lastAction = 'biggityBoom';
        actionOrder.push(lastAction);
      },
      whompWhomp: function() {
        lastAction = 'whompWhomp';
        actionOrder.push(lastAction);
      },
      sloopyDookie: function() {
        lastAction = 'sloopyDookie';
        actionOrder.push(lastAction);
      }
    }
  }).create();

  run(function() {
    view.set('controller', controller);
    view.appendTo('#qunit-fixture');
  });

  var testBoundAction = function(propertyValue) {
    run(function() {
      view.$("#"+propertyValue).click();
    });

    equal(lastAction, propertyValue, 'lastAction set to ' + propertyValue);
  };

  testBoundAction('whompWhomp');
  testBoundAction('sloopyDookie');
  testBoundAction('biggityBoom');

  deepEqual(actionOrder, ['whompWhomp', 'sloopyDookie', 'biggityBoom'], 'action name was looked up properly');
});

test("a quoteless parameter that does not resolve to a value asserts", function() {
  var triggeredAction;

  view = EmberView.create({
    template: compile("<a id='oops-bound-param' {{action ohNoeNotValid}}>Hi</a>")
  });

  var controller = EmberController.extend({
    actions: {
      ohNoeNotValid: function() {
        triggeredAction = true;
      }
    }
  }).create();

  run(function() {
    view.set('controller', controller);
    view.appendTo('#qunit-fixture');
  });

  expectAssertion(function() {
    run(function() {
      view.$("#oops-bound-param").click();
    });
  }, "You specified a quoteless path to the {{action}} helper " +
     "which did not resolve to an action name (a string). " +
     "Perhaps you meant to use a quoted actionName? (e.g. {{action 'save'}}).");
});

QUnit.module("ember-routing-htmlbars: action helper - deprecated invoking directly on target", {
  setup: function() {
    originalActionHelper = helpers['action'];
    registerHelper('action', actionHelper);

    dispatcher = EventDispatcher.create();
    dispatcher.setup();
  },

  teardown: function() {
    delete helpers['action'];
    helpers['action'] = originalActionHelper;

    runDestroy(view);
    runDestroy(dispatcher);
  }
});

test("should respect preventDefault=false option if provided", function() {
  view = EmberView.create({
    template: compile("<a {{action 'show' preventDefault=false}}>Hi</a>")
  });

  var controller = EmberController.extend({
    actions: {
      show: function() { }
    }
  }).create();

  run(function() {
    view.set('controller', controller);
    runAppend(view);
  });

  var event = jQuery.Event("click");
  view.$('a').trigger(event);

  equal(event.isDefaultPrevented(), false, "should not preventDefault");
});
