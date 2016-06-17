(function(window, $, undefined) {
	"use strict";

	var cache = {};

	$.postFinder = function(element, options) {
		var defaults, mainTemplate, itemTemplate, $li;

		if ( 'mainTemplate' in cache ) {
			mainTemplate = cache['mainTemplate'];
		} else {
			mainTemplate = cache['mainTemplate'] = $('#tmpl-post-finder-main').html();
		}

		if ( 'itemTemplate' in cache ) {
			itemTemplate = cache['itemTemplate'];
		} else {
			itemTemplate = cache['itemTemplate'] = $('#tmpl-post-finder-item').html();
		}

		defaults = {
			template:        mainTemplate,
			fieldSelector:   'input[type=hidden]',
			selectSelector:  'select',
			listSelector:    '.list',
			searchSelector:  '.search',
			resultsSelector: '.results',
			querySelector:   'input[type=text]',
			nonceSelector:   '#post_finder_nonce'
		};

		var plugin = this;

		plugin.settings = {}; //empty object to store extended settings

		var $element = $(element), //store jquery object of el
			element  = element; //store html el

		plugin.init = function() {

			// over write defaults with passed options
			plugin.settings = $.extend({}, defaults, options);

			// all jquery objects are fetched once and stored in the plugin object
			plugin.$field   = $element.find(plugin.settings.fieldSelector),
			plugin.$select  = $element.find(plugin.settings.selectSelector),
			plugin.$list    = $element.find(plugin.settings.listSelector),
			plugin.$search  = $element.find(plugin.settings.searchSelector),
			plugin.$results = plugin.$search.find(plugin.settings.resultsSelector),
			plugin.$query   = plugin.$search.find(plugin.settings.querySelector),
			plugin.nonce    = $(plugin.settings.nonceSelector).val();

			// bind select
			plugin.$select.on('change', function(e){
				plugin.add_item( $(this).val(), $('option:selected', this).text(), $('option:selected', this).data('permalink') );
			});

			// bind search button
			plugin.$search.find('.button').click(function(e){
				e.preventDefault();
				plugin.search();
			});

			// search on enter key press
			plugin.$search.find('input[type="text"]').keypress(function(e){
				if (e.which == 13) {
					e.preventDefault();
					plugin.search();
				}
			});

			// Search on keyup (debounced).
			plugin.$search.on( 'keyup', function( e ) {
				e.preventDefault();
				plugin.debouncedSearch();
			} );

			// bind list
			plugin.$list.sortable({
				placeholder: 'placeholder',
				update: function(ui, e) {
					plugin.serialize();
				}
			});

			// remove button
			plugin.$list.on('click', '.icon-remove', function(e){
				e.preventDefault();
				plugin.remove_item( $(this).closest('li').data('id') );
			});

			// add button
			plugin.$results.on('click', '.add', function(e){
				e.preventDefault();
				$li = $(this).closest('li');
				plugin.add_item( $li.data('id'), $li.find('span').text(), $li.data('permalink') );
			});

			// bind number inputs
			plugin.$list.on('keypress', 'li input', function(e) {
				if( e.which == 13 ) {
					e.preventDefault();
					//plugin.move_item( $(this).closest('li'), $(this).val() );
					$(this).trigger('blur');
				}
			});

			plugin.$list.on('blur', 'li input', function(e){
				plugin.move_item( $(this).closest('li'), $(this).val() );
			});

			// Disable adding items when the maximum has been reached already.
			if( plugin.$list.find('li').length >= ( $element.data('limit') ) ) {
				plugin.disableInputs();
			} else {
				plugin.search();
			}

		};

		// move an element to a specific position if possible
		plugin.move_item = function( $el, pos ) {

			var $li = plugin.$list.find('li'),
				len = $li.length,
				$clone;

			// has to be a position thats available
			if( pos > len || pos < 1 ) {
				alert( 'Please pick a position between 1 and ' + len );
				return false;
			}

			// dont move it if were already there
			if( ( pos - 1 ) == $el.index() ) {
				return false;
			}

			// clone the element
			$clone = $el.clone();

			// first position
			if( pos == 1 ) {

				plugin.$list.prepend( $clone );

			// middle positions
			} else if( pos > 1 && pos < len ) {

				plugin.$list.find('li').eq( pos - 1 ).before( $clone );

			// last position
			} else if( pos == len ) {

				plugin.$list.append( $clone );
			}

			// remove the original element
			$el.remove();

			plugin.serialize();

		};

		plugin.disableInputs = function() {
			plugin.$search.find( 'input, button' ).prop( 'disabled', true ).val( '' );
			plugin.$select.prop( 'disabled', true );

			// Remove any existing search results.
			plugin.$results.find( 'li' ).remove();
		}

		plugin.enableInputs = function() {
			plugin.$search.find( 'input, button' ).prop( 'disabled', false );
			plugin.$select.prop( 'disabled', false );
		}

		plugin.add_item = function( id, title, permalink ) {//private method

			var template = _.template( plugin.settings.template );

			// make sure we have an id
			if( id == 0 )
				return;

			if( plugin.$list.find('li').length >= ( $element.data('limit') - 1 ) ) {
				plugin.disableInputs();
			}

			// add item
			plugin.$list.append( template( {
				id:        id,
				title:     title,
				edit_url:  POST_FINDER_CONFIG.adminurl + 'post.php?post=' + id + '&action=edit',
				permalink: permalink,
				pos:       plugin.$list.length + 1
			} ) );

			// hide notice
			plugin.$list.find('.notice').hide();

			// remove from select if there
			plugin.$select.find('option[value="' + id + '"]').remove();

			// update the input
			plugin.serialize();
		};

		//Prv method to remove an item
		plugin.remove_item = function( id ) {

			// After removing an item, ensure imputs enabled.
			plugin.enableInputs();

			plugin.$list.find('li[data-id="' + id + '"]').remove();

			plugin.serialize();

			// show notice if no posts
			if( plugin.$list.find('li').length == 0 ) {
				plugin.$list.find('.notice').show();
			}
		};

		plugin.search = function() {

			var html = '',
				data = {
					action: 'pf_search_posts',
					s: plugin.$query.val(),
					not_in: plugin.$field.val(),
					_ajax_nonce: plugin.nonce
				},
				template = _.template( itemTemplate );

			// merge the default args in
			data = $.extend(data, $element.data('args'));

			// display loading
			plugin.$search.addClass('loading');

			$.ajax(
				ajaxurl,
				{
					type: 'POST',
					data: data,
					success: function(response) {
						if( typeof response.posts != "undefined" ) {
							if ( response.posts.length > 0 ) {
								for( var i in response.posts ) {
									html += template( response.posts[i] );
								}
							} else {
								html = '<li>' + POST_FINDER_CONFIG.nothing_found + '</li>';
							}
							plugin.$results.html(html);
						}
					},
					dataType: 'json'
				}
			);
		};

		plugin.debouncedSearch = _.debounce( plugin.search, 250 );

		plugin.serialize = function() {

			var ids = [], i = 1;

			plugin.$list.find('li').each(function(){
				$(this).find('input').val(i);
				ids.push( $(this).data('id') );
				i++;
			});

			plugin.$field.val( ids.join(',') );

			$( document ).trigger( 'updatePostfinder', plugin.$field );
		}

		plugin.init();

	};

	$.fn.postFinder = function(options) {

		return this.each(function() {
			if (undefined == $(this).data('postFinder')) {
				var plugin = new $.postFinder(this, options);
				$(this).data('postFinder', plugin);
			}
		});

	};

})(window, jQuery);