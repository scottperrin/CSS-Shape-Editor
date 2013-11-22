/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define */

define(['Editor','CSSUtils'], function(Editor, CSSUtils){
    "use strict";
    
    var _defaults = {
        path: {
            stroke: 'black',
            fill: 'rgba(0,0,0,0)' // tricks transform editor to accept self-drag
        },
        xUnit: 'px',
        yUnit: 'px',
        wUnit: 'px',
        hUnit: 'px',
        rxUnit: 'px',
        ryUnit: 'px'
    }
    
    function RectangleEditor(target, value, options){
        Editor.apply(this, arguments);
        
        // coordinates for rectangle: x,y for origin, with, height and units
        this.coords = null
        
        // TODO: extend with options
        this.config = _defaults;
        
        this.setup();
        this.applyOffsets();
        this.draw()
        
        this.toggleFreeTransform()
    }
    
    RectangleEditor.prototype = Object.create(Editor.prototype);
    RectangleEditor.prototype.constructor = RectangleEditor

    RectangleEditor.prototype.setup = function(){
        // Sets up: this.holder, this.paper, this.snap, this.offsets
        Editor.prototype.setup.call(this);
        
        this.coords = this.parseShape(this.value);
        
        if (!this.coords){
            this.coords = this.inferShapeFromElement(this.target)
        }
        
        this.shape = this.paper.rect().attr(this.config.path);
        
        // TODO: throttle sensibly
        window.addEventListener('resize', this.refresh.bind(this));
    };
    
    RectangleEditor.prototype.refresh = function(){
        this.removeOffsets();
        this.setupOffsets();
        this.applyOffsets();
        this.draw();
    };
    
    /*
        Add the element's offsets to the rectangle origin coordinates
        
        The editor surface covers 100% of the viewport and we're working 
        with absolute units while editing.
        
        @see RectangleEditor.removeOffsets()
    */
    RectangleEditor.prototype.applyOffsets = function(){
        var x = this.coords.x + this.offsets.left,
            y = this.coords.y + this.offsets.top;
        
        this.coords.x = x;
        this.coords.y = y;
    };
    
    /*
        Subtract the element's offsets from the rectangle origin coordinates
        
        @see RectangleEditor.applyOffsets()
    */
    RectangleEditor.prototype.removeOffsets = function(){
        var x = this.coords.x - this.offsets.left,
            y = this.coords.y - this.offsets.top;
        
        this.coords.x = x;
        this.coords.y = y;
    };
    
    /*
        Parse rectangle string into object with coordinates for origin, dimensions, borer-radius and units
        Returns undefined if cannot parse shape.
        
        @example:
        {
            x: 0,          // x of origin (top-left corner)
            xUnit: 'px',
            y: 0,          // y of origin (top-left corner)
            yUnit: 'px',
            w: 50,         // rectangle width
            wUnit: '%',
            h: 50,         // rectangle height
            hUnit: '%'
            rx: 5,        // [optional] horizontal radius for rounded corners
            rxUnit: '%'
            ry: 5,        // [optional] vertical radius for rounded corners
            ryUnit: '%'
        }
        
        @param {String} shape CSS rectangle function shape
        
        @return {Object | undefined}
    */
    RectangleEditor.prototype.parseShape = function(shape){
        var element = this.target,
            coords,
            infos,
            args;

        // superficial check for ellipse declaration
        if (typeof shape != 'string' || !/^rectangle\(.*?\)/i.test(shape.trim())){

            // remove editor DOM saffolding
            this.remove();

            throw Error('No rectangle() function definition in provided value');
            return
        }
        
        if (infos = /rectangle\s*\(((\s*[-+0-9.]+[a-z%]*\s*,*\s*){4,6})\s*\)/i.exec(shape.trim())){
            if (!infos[1]){
                return
            }
            
            args = infos[1].replace(/\s+/g, '').split(',');
            
            // incomplete rectangle definition
            if (args.length < 4){
                return
            }
            
            args = args.map(function(arg, i){
                var isHeightRelated = !!(i%2);
                return CSSUtils.convertToPixels(arg, element, isHeightRelated);
            })
            
            coords = {
                x: args[0].value,
                xUnit: args[0].unit,
                y: args[1].value,
                yUnit: args[1].unit,
                w: args[2].value,
                wUnit: args[2].unit,
                h: args[3].value,
                hUnit: args[3].unit
            }
            
            if (args[4]){
                coords.rx = args[4].value;
                coords.rxUnit = args[4].unit;
                
                if (!args[5]){
                    // only one radius defined, use same for both rx and ry
                    coords.ry = args[4].value;
                    coords.ryUnit = args[4].unit;
                }
                else{
                    // special radius defined for ry, use that.
                    coords.ry = args[5].value;
                    coords.ryUnit = args[5].unit;
                }
            }
        } 
        
        return coords
    };
    
    /*
        Attempt to infer the coordinates for a rectangle that fits within the element.
        The origin is the element's top-left corner. 
        The width is the element's width; likewise the height.
        
        @throws Error if the element has no width or height.
        
        @param {HTMLElement} element Element from which to infer the shape.
        @return {Object} coordinates for rectangle. @see RectangleEditor.parseShape()
    */
    RectangleEditor.prototype.inferShapeFromElement = function(element){
        if (!(element instanceof HTMLElement)){
            throw TypeError('inferShapeFromElement() \n Expected HTMLElement, got: ' + typeof element + ' ' + element)
        }
        
        var box = CSSUtils.getContentBoxOf(element);

        if (!box.height || !box.width){
            throw Error('inferShapeFromElement() \n Cannot infer shape from element because it has no width or height')
        }
        
        // TODO: also infer unit values
        return {
            x: 0,
            xUnit: this.config.xUnit,
            y: 0,
            yUnit: this.config.yUnit,
            w: box.width,
            wUnit: this.config.wUnit,
            h: box.height,
            hUnit: this.config.hUnit
        }
    };
    
    RectangleEditor.prototype.getCSSValue = function(){
        var cx = this.coords.cx - this.offsets.left,
            cy = this.coords.cy - this.offsets.top,
            rx = this.coords.rx,
            ry = this.coords.ry;
            
        cx = CSSUtils.convertFromPixels(cx, this.coords.cxUnit, this.target, false);
        cy = CSSUtils.convertFromPixels(cy, this.coords.cyUnit, this.target, false);
        rx = CSSUtils.convertFromPixels(rx, this.coords.rxUnit, this.target, true);
        ry = CSSUtils.convertFromPixels(ry, this.coords.ryUnit, this.target, true);
        
        return 'ellipse(' + [cx, cy, rx, ry].join(', ') + ')'
    };
    
    RectangleEditor.prototype.toggleFreeTransform = function(){
        
        // make a clone to avoid compound tranforms
        var coordsClone = (JSON.parse(JSON.stringify(this.coords)));
        
        function _transformPoints(){
            var matrix = this.shapeClone.transform().localMatrix;
            
            this.coords.cx = matrix.x(coordsClone.cx, coordsClone.cy);
            this.coords.cy = matrix.y(coordsClone.cx, coordsClone.cy);
            this.coords.rx = this.transformEditor.attrs.scale.x * coordsClone.rx;
            this.coords.ry = this.transformEditor.attrs.scale.y * coordsClone.ry;
            
            this.draw()
        }
        
        if (this.transformEditor){
            this.shapeClone.remove();
            this.transformEditor.unplug();
            delete this.transformEditor
            
            return;
        }
        
        // using a phantom shape because we already redraw the path by the transformed coordinates.
        // using the same path would result in double transformations for the shape
        this.shapeClone = this.shape.clone().attr('stroke', 'none')
        
        this.transformEditor = Snap.freeTransform(this.shapeClone, {
            draw: ['bbox'],
            drag: ['self','center'],
            keepRatio: ['bboxCorners'],
            rotate: [], // ellipses do not rotate
            scale: ['bboxCorners','bboxSides'],
            distance: '0.6'
        }, _transformPoints.bind(this));
    };
    
    
    RectangleEditor.prototype.draw = function(){
        
        // draw the rectangle
        this.shape.attr({
            x: this.coords.x,
            y: this.coords.y,
            width: this.coords.w,
            height: this.coords.h,
            rx : this.coords.rx || 0,
            ry : this.coords.rx || 0
        });
        
        this.trigger('shapechange', this);
    };
    
    return RectangleEditor
})