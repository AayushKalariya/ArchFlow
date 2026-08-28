We need the base chrome components that frame every editor screen - the top navbar and the left sidebar shell. These 
will be reused and extended in every chapter that follows. 


### Editor Navbar

Create `components/editor/editor-navbar.tsx`

Requirements:

- fixed-height top navbar
- left, center, and right sections
- left section contains sidebar toggle button
- use the appropriate icons based on the sidebar state.
- right section stays empty for now
- dark background with subtle bottom border


### Project sidebar

Create a `components/editor/project-sidebar.tsx`.

Requirements:

- sidebar should float above the editor canvas
- opening it should not push the page content
- slides in from the left
- accepts the isOpen and onClose prop
- header with `Projects` title + close button
- shadcn `Tabs`:
    - My projects
    - Shared
- both tabs show empty placeholder state 
- full-width `New Project` button at the bottom with a plus icon.


### Dialog Pattern

Use the existing color token that sit in `globals.css` and use it for the styling.

Support:
- title
-description
-footer actions

Do not build acutal dialogs yet. 

### Check when done

- new components compile without Typescript errors
- no lint erros
- dialog pattern is ready for future use