lm.items.RowOrColumn = function( isColumn, layoutManager, config, parent ) {
	lm.items.AbstractContentItem.call( this, layoutManager, config, parent );

	this.isRow = !isColumn;
	this.isColumn = isColumn;

	this.element = $( '<div class="lm_item lm_' + ( isColumn ? 'column' : 'row' ) + '"></div>' );
	this.childElementContainer = this.element;
	this._splitterSize = layoutManager.config.dimensions.borderWidth;
	this._splitterGrabSize = layoutManager.config.dimensions.borderGrabWidth;
	this._isColumn = isColumn;
	this._dimension = isColumn ? 'height' : 'width';
	this._splitter = [];
	this._splitterPosition = null;
	this._splitterMinPosition = null;
	this._splitterMaxPosition = null;
};

lm.utils.extend( lm.items.RowOrColumn, lm.items.AbstractContentItem );

lm.utils.copy( lm.items.RowOrColumn.prototype, {

	/**
	 * Add a new contentItem to the Row or Column
	 *
	 * @param {lm.item.AbstractContentItem} contentItem
	 * @param {[int]} index The position of the new item within the Row or Column.
	 *                      If no index is provided the item will be added to the end
	 * @param {[bool]} _$suspendResize If true the items won't be resized. This will leave the item in
	 *                                 an inconsistent state and is only intended to be used if multiple
	 *                                 children need to be added in one go and resize is called afterwards
	 *
	 * @returns {void}
	 */
	addChild: function( contentItem, index, _$suspendResize ) {

		var newItemSize, itemSize, i, splitterElement;

		contentItem = this.layoutManager._$normalizeContentItem( contentItem, this );

		if( index === undefined ) {
			index = this.contentItems.length;
		}

		if( this.contentItems.length > 0 ) {
			splitterElement = this._createSplitter( Math.max( 0, index - 1 ) ).element;

			if( index > 0 ) {
				this.contentItems[ index - 1 ].element.after( splitterElement );
				splitterElement.after( contentItem.element );
			} else {
				this.contentItems[ 0 ].element.before( splitterElement );
				splitterElement.before( contentItem.element );
			}
		} else {
			this.childElementContainer.append( contentItem.element );
		}

		lm.items.AbstractContentItem.prototype.addChild.call( this, contentItem, index );

		newItemSize = ( 1 / this.contentItems.length ) * 100;

		if( _$suspendResize === true ) {
			this.emitBubblingEvent( 'stateChanged' );
			return;
		}

		for( i = 0; i < this.contentItems.length; i++ ) {
			if( this.contentItems[ i ] === contentItem ) {
				contentItem.config[ this._dimension ] = newItemSize;
			} else {
				itemSize = this.contentItems[ i ].config[ this._dimension ] *= ( 100 - newItemSize ) / 100;
				this.contentItems[ i ].config[ this._dimension ] = itemSize;
			}
		}

		this.callDownwards( 'setSize' );
		this.emitBubblingEvent( 'stateChanged' );
	},

	/**
	 * Removes a child of this element
	 *
	 * @param   {lm.items.AbstractContentItem} contentItem
	 * @param   {boolean} keepChild   If true the child will be removed, but not destroyed
	 *
	 * @returns {void}
	 */
	removeChild: function( contentItem, keepChild ) {
		var removedItemSize = contentItem.config[ this._dimension ],
			index = lm.utils.indexOf( contentItem, this.contentItems ),
			splitterIndex = Math.max( index - 1, 0 ),
			i,
			childItem;

		if( index === -1 ) {
			throw new Error( 'Can\'t remove child. ContentItem is not child of this Row or Column' );
		}

		/**
		 * Remove the splitter before the item or after if the item happens
		 * to be the first in the row/column
		 */
		if( this._splitter[ splitterIndex ] ) {
			this._splitter[ splitterIndex ]._$destroy();
			this._splitter.splice( splitterIndex, 1 );
		}

		/**
		 * Allocate the space that the removed item occupied to the remaining items
		 */
		for( i = 0; i < this.contentItems.length; i++ ) {
			if( this.contentItems[ i ] !== contentItem ) {
				this.contentItems[ i ].config[ this._dimension ] += removedItemSize / ( this.contentItems.length - 1 );
			}
		}

		lm.items.AbstractContentItem.prototype.removeChild.call( this, contentItem, keepChild );

		if( this.contentItems.length === 1 && this.config.isClosable === true ) {
			childItem = this.contentItems[ 0 ];
			this.contentItems = [];
			this.parent.replaceChild( this, childItem, true );
		} else {
			this.callDownwards( 'setSize' );
			this.emitBubblingEvent( 'stateChanged' );
		}
	},

	/**
	 * Replaces a child of this Row or Column with another contentItem
	 *
	 * @param   {lm.items.AbstractContentItem} oldChild
	 * @param   {lm.items.AbstractContentItem} newChild
	 *
	 * @returns {void}
	 */
	replaceChild: function( oldChild, newChild ) {
		var size = oldChild.config[ this._dimension ];
		lm.items.AbstractContentItem.prototype.replaceChild.call( this, oldChild, newChild );
		newChild.config[ this._dimension ] = size;
		this.callDownwards( 'setSize' );
		this.emitBubblingEvent( 'stateChanged' );
	},

	/**
	 * Called whenever the dimensions of this item or one of its parents change
	 *
	 * @returns {void}
	 */
	setSize: function() {
		if( this.contentItems.length > 0 ) {
			this._calculateRelativeSizes();
			this._setAbsoluteSizes();
		}
		this.emitBubblingEvent( 'stateChanged' );
		this.emit( 'resize' );
	},

	/**
	 * Invoked recursively by the layout manager. AbstractContentItem.init appends
	 * the contentItem's DOM elements to the container, RowOrColumn init adds splitters
	 * in between them
	 *
	 * @package private
	 * @override AbstractContentItem._$init
	 * @returns {void}
	 */
	_$init: function() {
		if( this.isInitialised === true ) return;

		var i;

		lm.items.AbstractContentItem.prototype._$init.call( this );

		for( i = 0; i < this.contentItems.length - 1; i++ ) {
			this.contentItems[ i ].element.after( this._createSplitter( i ).element );
		}
	},

	/**
	 * Turns the relative sizes calculated by _calculateRelativeSizes into
	 * absolute pixel values and applies them to the children's DOM elements
	 *
	 * Assigns additional pixels to counteract Math.floor
	 *
	 * @private
	 * @returns {void}
	 */
	_setAbsoluteSizes: function() {
		var i,
			sizeData = this._calculateAbsoluteSizes();

		for( i = 0; i < this.contentItems.length; i++ ) {
			if( sizeData.additionalPixel - i > 0 ) {
				sizeData.itemSizes[ i ]++;
			}

			if( this._isColumn ) {
				this.contentItems[ i ].element.width( sizeData.totalWidth );
				this.contentItems[ i ].element.height( sizeData.itemSizes[ i ] );
			} else {
				this.contentItems[ i ].element.width( sizeData.itemSizes[ i ] );
				this.contentItems[ i ].element.height( sizeData.totalHeight );
			}
		}
	},

	/**
	 * Calculates the absolute sizes of all of the children of this Item.
	 * @returns {object} - Set with absolute sizes and additional pixels.
	 */
	_calculateAbsoluteSizes: function() {
		var i,
			totalSplitterSize = (this.contentItems.length - 1) * this._splitterSize,
			totalWidth = this.element.width(),
			totalHeight = this.element.height(),
			totalAssigned = 0,
			totalAssignedHeight = 0,
			totalAssignedWidth = 0,
			additionalPixel,
			additionalPixelHeight,
			additionalPixelWidth,
			itemSize,
			itemSizeHeight,
			itemSizeWidth,
			itemSizes = [],
			itemSizesHeight = [],
			itemSizesWidth = [];

			totalHeight -= totalSplitterSize;
			totalWidth -= totalSplitterSize;

		for( i = 0; i < this.contentItems.length; i++ ) {
			itemSizeHeight = Math.floor( totalHeight * ( ( this.contentItems[ i ].config.height || 0) / 100 ) );
			itemSizeHeight = itemSizeHeight || 0;
			itemSizeWidth = Math.floor( totalWidth * ( ( this.contentItems[ i ].config.width || 0 ) / 100) );
			itemSizeWidth = itemSizeWidth || 0;

			if( this._isColumn ) {
				itemSize = Math.floor( totalHeight * ( this.contentItems[ i ].config.height / 100 ) );
			} else {
				itemSize = Math.floor( totalWidth * (this.contentItems[ i ].config.width / 100) );
			}

			totalAssigned += itemSize;
			totalAssignedHeight += itemSizeHeight;
			totalAssignedWidth += itemSizeWidth;
			itemSizes.push( itemSize );
			itemSizesHeight.push( itemSizeHeight );
			itemSizesWidth.push( itemSizeWidth );
		}

		totalAssignedHeight = totalAssignedHeight || 0;
		totalAssignedWidth = totalAssignedWidth || 0;

		additionalPixel = Math.floor( (this._isColumn ? totalHeight : totalWidth) - totalAssigned );
		additionalPixelHeight = Math.floor( totalHeight - totalAssignedHeight );
		additionalPixelWidth = Math.floor( totalWidth - totalAssignedWidth );

		return {
			itemSizes: itemSizes,
			itemSizesHeight: itemSizesHeight,
			itemSizesWidth: itemSizesWidth,
			additionalPixel: additionalPixel,
			additionalPixelHeight: additionalPixelHeight,
			additionalPixelWidth: additionalPixelWidth,
			totalWidth: totalWidth,
			totalHeight: totalHeight
		};
	},

	/**
	 * Calculates the relative sizes of all children of this Item. The logic
	 * is as follows:
	 *
	 * - Add up the total size of all items that have a configured size
	 *
	 * - If the total == 100 (check for floating point errors)
	 *        Excellent, job done
	 *
	 * - If the total is > 100,
	 *        set the size of items without set dimensions to 1/3 and add this to the total
	 *        set the size off all items so that the total is hundred relative to their original size
	 *
	 * - If the total is < 100
	 *        If there are items without set dimensions, distribute the remainder to 100 evenly between them
	 *        If there are no items without set dimensions, increase all items sizes relative to
	 *        their original size so that they add up to 100
	 *
	 * @private
	 * @returns {void}
	 */
	_calculateRelativeSizes: function() {
		var i,
			total = 0,
			itemsWithoutSetDimension = [],
			dimension = this._isColumn ? 'height' : 'width';

		for( i = 0; i < this.contentItems.length; i++ ) {
			if( this.contentItems[ i ].config[ dimension ] !== undefined ) {
				total += this.contentItems[ i ].config[ dimension ];
			} else {
				itemsWithoutSetDimension.push( this.contentItems[ i ] );
			}
		}

		/**
		 * Everything adds up to hundred, all good :-)
		 */
		if( Math.round( total ) === 100 ) {
			this._respectMinItemWidth();
			this._respectMinItemHeight();
			return;
		}

		/**
		 * Allocate the remaining size to the items without a set dimension
		 */
		if( Math.round( total ) < 100 && itemsWithoutSetDimension.length > 0 ) {
			for( i = 0; i < itemsWithoutSetDimension.length; i++ ) {
				itemsWithoutSetDimension[ i ].config[ dimension ] = ( 100 - total ) / itemsWithoutSetDimension.length;
			}
			this._respectMinItemWidth();
			this._respectMinItemHeight();
			return;
		}

		/**
		 * If the total is > 100, but there are also items without a set dimension left, assing 50
		 * as their dimension and add it to the total
		 *
		 * This will be reset in the next step
		 */
		if( Math.round( total ) > 100 ) {
			for( i = 0; i < itemsWithoutSetDimension.length; i++ ) {
				itemsWithoutSetDimension[ i ].config[ dimension ] = 50;
				total += 50;
			}
		}

		/**
		 * Set every items size relative to 100 relative to its size to total
		 */
		for( i = 0; i < this.contentItems.length; i++ ) {
			this.contentItems[ i ].config[ dimension ] = ( this.contentItems[ i ].config[ dimension ] / total ) * 100;
		}

		this._respectMinItemWidth();
		this._respectMinItemHeight();
	},

	_getMinItemSize: function( dimension ) {
		var configSettingsDimension = dimension === 'height' ? 'minItemHeight' : 'minItemWidth',
		    configItemDimension = dimension === 'height' ? 'minItemHeight' : 'minItemWidth',
				minItemSize = this.layoutManager.config.dimensions ? (this.layoutManager.config.dimensions[ configSettingsDimension ] || 0) : 0;

		var contentItemsMinItemSize = this.config[ configItemDimension ] || 0;

		if ( this.contentItems.length > 0 ) {
			contentItemsMinItemSize = this._findMinSizeOfItems( this.contentItems, dimension );
		}

		return Math.max( minItemSize, contentItemsMinItemSize );
	},

	_findMinSizeOfItems: function( contentItems, dimension ) {
		var minItemSize = 0,
				contentItem = null,
				configDimension = dimension === 'height' ? 'minHeight' : 'minWidth';

		for ( var i = 0; i < contentItems.length; i++ ) {
			contentItem = contentItems[ i ];

			minItemSize = Math.max(
				minItemSize,
				contentItem.config ? ( contentItem.config[ configDimension ] || 0 ) : 0
			);

			if ( contentItem.contentItems ) {
				minItemSize = Math.max(
					minItemSize,
					this._findMinSizeOfItems( contentItem.contentItems, dimension )
				);
			}
		}

		return minItemSize;
	},

	_respectMinItemHeight: function() {
		this._respectMinItemSize( 'height' );
	},

	_respectMinItemWidth: function() {
		this._respectMinItemSize( 'width' );
	},

	/**
	 * Adjusts the column widths to respect the dimensions minItemWidth if set.
	 *
	 * @private
	 * @param   {String} dimension The dimension to respect size for.  height or width.
	 * @returns {void}
	 */
	_respectMinItemSize: function( dimension ) {
	  var minItemSize = this._getMinItemSize( dimension ),
	    sizeData = null,
	    entriesOverMin = [],
	    totalOverMin = 0,
	    totalUnderMin = 0,
	    remainingSize = 0,
	    itemSize = 0,
	    contentItem = null,
	    reducePercent,
	    reducedSize,
	    allEntries = [],
	    entry;

		// nothing within this row/column has a minimum size for the specified
		// dimension so there is no need to respect size
	  if( !minItemSize || this.contentItems.length < 1 ) {
	    return;
	  }

	  sizeData = this._calculateAbsoluteSizes();

	  /**
	   * Figure out how much we are under the min item size total and how much room we have to use.
	   */
	  for( var i = 0; i < this.contentItems.length; i++ ) {
	    contentItem = this.contentItems[ i ];
	    itemSize = dimension === 'height' ?
				sizeData.itemSizesHeight[ i ] :
				sizeData.itemSizesWidth[ i ];

			var entryMinSize = this._findMinSizeOfItems(contentItem.contentItems, dimension);

			if( itemSize < entryMinSize ) {
	      totalUnderMin += entryMinSize - itemSize;
	      entry = { size: entryMinSize };
	    }
	    else {
	      totalOverMin += itemSize - entryMinSize;
	      entry = { size: itemSize };
	      entriesOverMin.push( entry );
	    }

			entry.minSize = entryMinSize;

	    allEntries.push( entry );
	  }

	  /**
	   * If there is nothing under min, or there is not enough over to make up the difference, do nothing.
	   */
		if( totalUnderMin === 0 || totalUnderMin > totalOverMin ) {
	    return;
	  }

	  /**
	   * Evenly reduce all items that are over the min item size to make up the difference.
	   */
	  reducePercent = totalUnderMin / totalOverMin;
	  remainingSize = totalUnderMin;
	  for( i = 0; i < entriesOverMin.length; i++ ) {
	    entry = entriesOverMin[ i ];
	    reducedSize = Math.round( ( entry.size - entry.minSize ) * reducePercent );
	    remainingSize -= reducedSize;
	    entry.size -= reducedSize;
		}

	  /**
	   * Take anything remaining from the last item.
	   */
	  if( remainingSize !== 0 ) {
			allEntries[ allEntries.length - 1 ].size -= remainingSize;
	  }

	  /**
	   * Set every items size relative to 100 relative to its size to total
	   */
	  for( i = 0; i < this.contentItems.length; i++ ) {
			if ( dimension === 'height' ) {
				this.contentItems[ i ].config.height = ( allEntries[ i ].size / sizeData.totalHeight ) * 100;
			} else {
				this.contentItems[ i ].config.width = (allEntries[ i ].size / sizeData.totalWidth) * 100;
			}
		}
	},

	/**
	 * Instantiates a new lm.controls.Splitter, binds events to it and adds
	 * it to the array of splitters at the position specified as the index argument
	 *
	 * What it doesn't do though is append the splitter to the DOM
	 *
	 * @param   {Int} index The position of the splitter
	 *
	 * @returns {lm.controls.Splitter}
	 */
	 _createSplitter: function( index ) {
 		var splitter;
 		splitter = new lm.controls.Splitter( this._isColumn, this._splitterSize, this._splitterGrabSize, this.layoutManager.config.settings.enableSplitterToggleButtons );
 		splitter.on( 'drag', lm.utils.fnBind( this._onSplitterDrag, this, [ splitter ] ), this );
 		splitter.on( 'dragStop', lm.utils.fnBind( this._onSplitterDragStop, this, [ splitter ] ), this );
 		splitter.on( 'dragStart', lm.utils.fnBind( this._onSplitterDragStart, this, [ splitter ] ), this );

 		var toggleButton = splitter.element.find( '.lm_toggle_button' );

 		if ( toggleButton ) {
 			splitter._toggleButton = toggleButton;

 			toggleButton.changeState = function( state ) {
 				if ( state === 'open' ) {
 					if ( this._isColumn ) {
 						toggleButton.removeClass( 'lm_toggle_button_up' ).addClass( 'lm_toggle_button_down' );
 					}  else {
 						toggleButton.removeClass ('lm_toggle_button_right' ).addClass( 'lm_toggle_button_left' );
 					}
 				} else {
 					if ( this._isColumn ) {
 						toggleButton.removeClass( 'lm_toggle_button_down' ).addClass( 'lm_toggle_button_up' );
 					}  else {
 						toggleButton.removeClass ('lm_toggle_button_left' ).addClass( 'lm_toggle_button_right' );
 					}
 				}
 			}.bind( this );

 			toggleButton.on( 'click', function() {
 				var items = this._getItemsForSplitter( splitter );
 				var container = this._findContainer( this._isColumn ? items.after : items.before );

 				console.log('toggling, previous position', this._splitterPreviousPosition)


 				if ( container ) {
 					if ( this._isColumn ) {
 						if ( this._splitterPreviousPosition > 0 ) {
 							console.log('%cOPEN column, setting width, height', 'color: green', items.after.element.width(), this._splitterPreviousPosition);
 							container.setSize( items.after.element.width(), this._splitterPreviousPosition );
 							this._splitterPreviousPosition = 0;
 							toggleButton.changeState( 'open' );
 						} else {
 							console.log('%cCLOSE column, setting width, height', 'color: red', items.after.element.width(), 1);
 							this._splitterPreviousPosition = items.after.element.height();
 							container.setSize( items.after.element.width(), 1 );
 							toggleButton.changeState( 'closed' );
 						}
 					} else {
 						if ( this._splitterPreviousPosition > 0 ) {
 							console.log('%cOPEN row, setting width, height', 'color: green', this._splitterPreviousPosition, items.before.element.height());
 							container.setSize( this._splitterPreviousPosition, items.before.element.height() );
 							this._splitterPreviousPosition = 0;
 							toggleButton.changeState( 'open' );
 						} else {
 							console.log('%cCLOSE column, setting width, height', 'color: red', 1, items.before.element.height());
 							this._splitterPreviousPosition = items.before.element.width();
 							container.setSize( 1, items.before.element.height() );
 							toggleButton.changeState( 'closed' );
 						}
 					}
 				}
 			}.bind( this ) );
 		}

 		this._splitter.splice( index, 0, splitter );
 		return splitter;
 	},

	_findContainer: function( root ) {
		if ( root.container ) {
			return root.container;
		} else if ( root.contentItems ) {
			var container;
			for ( var i = 0; i < root.contentItems.length; i++ ) {
				container = this._findContainer( root.contentItems[ i ] );
				if ( container ) {
					break;
				}
			}

			return container;
		}
	},

	/**
	 * Locates the instance of lm.controls.Splitter in the array of
	 * registered splitters and returns a map containing the contentItem
	 * before and after the splitters, both of which are affected if the
	 * splitter is moved
	 *
	 * @param   {lm.controls.Splitter} splitter
	 *
	 * @returns {Object} A map of contentItems that the splitter affects
	 */
	_getItemsForSplitter: function( splitter ) {
		var index = lm.utils.indexOf( splitter, this._splitter );

		return {
			before: this.contentItems[ index ],
			after: this.contentItems[ index + 1 ]
		};
	},

	/**
	 * Gets the minimum dimensions for the given item configuration array
	 * @param item
	 * @private
	 */
	_getMinimumDimensions: function( arr ) {
		var minWidth = 0, minHeight = 0;

		for( var i = 0; i < arr.length; ++i ) {
			minWidth = Math.max( arr[ i ].minWidth || 0, minWidth );
			minHeight = Math.max( arr[ i ].minHeight || 0, minHeight );
		}

		return { horizontal: minWidth, vertical: minHeight };
	},

	/**
	 * Invoked when a splitter's dragListener fires dragStart. Calculates the splitters
	 * movement area once (so that it doesn't need calculating on every mousemove event)
	 *
	 * @param   {lm.controls.Splitter} splitter
	 *
	 * @returns {void}
	 */
	_onSplitterDragStart: function( splitter ) {
		var items = this._getItemsForSplitter( splitter ),
			minSize = this.layoutManager.config.dimensions[ this._isColumn ? 'minItemHeight' : 'minItemWidth' ];

		var beforeMinDim = this._getMinimumDimensions( items.before.config.content );
		var beforeMinSize = this._isColumn ? beforeMinDim.vertical : beforeMinDim.horizontal;

		var afterMinDim = this._getMinimumDimensions( items.after.config.content );
		var afterMinSize = this._isColumn ? afterMinDim.vertical : afterMinDim.horizontal;

		this._splitterPosition = 0;
		this._splitterMinPosition = -1 * ( items.before.element[ this._dimension ]() - (beforeMinSize || minSize) );
		this._splitterMaxPosition = items.after.element[ this._dimension ]() - (afterMinSize || minSize);
	},

	/**
	 * Invoked when a splitter's DragListener fires drag. Updates the splitters DOM position,
	 * but not the sizes of the elements the splitter controls in order to minimize resize events
	 *
	 * @param   {lm.controls.Splitter} splitter
	 * @param   {Int} offsetX  Relative pixel values to the splitters original position. Can be negative
	 * @param   {Int} offsetY  Relative pixel values to the splitters original position. Can be negative
	 *
	 * @returns {void}
	 */
	_onSplitterDrag: function( splitter, offsetX, offsetY ) {
		var offset = this._isColumn ? offsetY : offsetX;

		if( offset > this._splitterMinPosition && offset < this._splitterMaxPosition ) {
			this._splitterPosition = offset;
			splitter.element.css( this._isColumn ? 'top' : 'left', offset );
		}
	},

	/**
	 * Invoked when a splitter's DragListener fires dragStop. Resets the splitters DOM position,
	 * and applies the new sizes to the elements before and after the splitter and their children
	 * on the next animation frame
	 *
	 * @param   {lm.controls.Splitter} splitter
	 *
	 * @returns {void}
	 */
	_onSplitterDragStop: function( splitter ) {
		var items = this._getItemsForSplitter( splitter ),
			sizeBefore = items.before.element[ this._dimension ](),
			sizeAfter = items.after.element[ this._dimension ](),
			splitterPositionInRange = ( this._splitterPosition + sizeBefore ) / ( sizeBefore + sizeAfter ),
			totalRelativeSize = items.before.config[ this._dimension ] + items.after.config[ this._dimension ];

		items.before.config[ this._dimension ] = splitterPositionInRange * totalRelativeSize;
		items.after.config[ this._dimension ] = ( 1 - splitterPositionInRange ) * totalRelativeSize;

		splitter.element.css( {
			'top': 0,
			'left': 0
		} );

		lm.utils.animFrame( lm.utils.fnBind( this.callDownwards, this, [ 'setSize' ] ) );
	}
} );
