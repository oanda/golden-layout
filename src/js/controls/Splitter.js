lm.controls.Splitter = function( isVertical, size, grabSize, enableToggleButton ) {
	this._isVertical = isVertical;
	this._size = size;
	this._grabSize = grabSize < size ? size : grabSize
	this._enableToggleButton = enableToggleButton;

	this.element = this._createElement();
	this._dragListener = new lm.utils.DragListener( this.element );
};

lm.utils.copy( lm.controls.Splitter.prototype, {
	on: function( event, callback, context ) {
		this._dragListener.on( event, callback, context );
	},

	_$destroy: function() {
		this.element.remove();
	},

	_createElement: function() {
		var dragHandle = $( '<div class="lm_drag_handle"></div>' );
		var element    = $( '<div class="lm_splitter"></div>' );
		element.append(dragHandle);

		var handleExcessSize = this._grabSize - this._size;
		var handleExcessPos  = handleExcessSize / 2;

		if( this._isVertical ) {
			dragHandle.css( 'top', -handleExcessPos );
			dragHandle.css( 'height', this._size + handleExcessSize );
			element.addClass( 'lm_vertical' );
			element[ 'height' ]( this._size );
		} else {
			dragHandle.css( 'left', -handleExcessPos );
			dragHandle.css( 'width', this._size + handleExcessSize );
			element.addClass( 'lm_horizontal' );
			element[ 'width' ]( this._size );
		}

		if ( this._enableToggleButton ) {
			var toggleButton = this._createToggleButton( element );
			element.append(toggleButton);
		}

		return element;
	},

	_createToggleButton: function( splitter ) {
		var element = $( '<div class="lm_toggle_button"></div>');
		var arrow = $( '<div class="lm_toggle_arrow"></div>' );
		element.append( arrow );

		if (this._isVertical) {
			element.addClass( 'lm_toggle_button_down' );
		} else {
			element.addClass( 'lm_toggle_button_left' );
		}

		return element;
	}
} );
