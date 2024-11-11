
class FDMTransformer {
    constructor() {
        this.editorName = 'universal-editor'
        this.typeMapping = {
            integer: {
                resourceType: "core/fd/components/form/numberinput/v1/numberinput",
                fieldType: "number-input"
            },
            boolean: {
                resourceType: "core/fd/components/form/checkbox/v1/checkbox",
                fieldType: "checkbox"
            },
            text: {
                resourceType: "core/fd/components/form/textinput/v1/textinput",
                fieldType: "text-input"
            },
            string: {
                resourceType: "core/fd/components/form/textinput/v1/textinput",
                fieldType: "text-input"
            },
            object: {
                resourceType: "core/fd/components/form/panelcontainer/v1/panelcontainer",
                fieldType: "panel"
            }
        };
    }

    convertToDataRef = (datapath) => {
        if(!datapath) return '';
        return datapath.split('/').filter(Boolean).map((segment, index) => {
            return index === 0 ? `$` : `.${segment}`;
        }).join('');
    }

    getComponentTypeDetails = (type) => {
        return this.typeMapping[type] ? this.typeMapping[type] : this.typeMapping['text'];
    }

    createBaseComponentObject = ({ label, dataRef, fieldType, resourceType }) => ({
        name: label,
        xwalk: {
            page: {
                resourceType,
                template: {
                    "jcr:title": label,
                    fieldType,
                    enabled: true,
                    visible: true,
                    dataRef
                }
            }
        }
    });

    buildNestedComponentStructure = (component) => {
        const { label, children = [], fieldType, resourceType } = component;
        const componentObj = {
            [`${fieldType}`]: {
                "sling:resourceType": resourceType,
                fieldType,
                "jcr:title": label,
                enabled: true,
                visible: true
            }
        };
    
        children.forEach(child => {
            Object.assign(componentObj[label], this.buildNestedComponentStructure(child));
        });
        
        return componentObj;
    };

    schemaToUEMapper = (fdmSchema) => {
        const mapProperties = (properties) => {
            if(!properties || properties.length === 0) {
                return []
            }
            return Object.keys(properties).map((modelName) => {
                const model = properties[modelName];
                return {
                    label: modelName,
                    fieldType: this.getComponentTypeDetails(model.type).fieldType,
                    resourceType: this.getComponentTypeDetails(model.type).resourceType, 
                    dataRef: this.convertToDataRef(model.datapath),
                    children: mapProperties(model.properties),
                };
            });
        };
        const rootItem = {
            label: fdmSchema.title || 'root',
            type: fdmSchema.type || 'panel',
            children: mapProperties(fdmSchema.properties),
        }
        return rootItem;
      };


      getTransformer = () => {
        return (fdmSchema) => {
            const items = this.schemaToUEMapper(fdmSchema)
            const baseObj = this.createBaseComponentObject(items);

            if (items.children && items.children.length) {
                items.children.forEach(child => {
                    Object.assign(baseObj.xwalk.page.template, this.buildNestedComponentStructure(child));
                });
            }

            return baseObj;
        }
    }

}

const FormatRegistry = {
    universalEditor: {
        fdm: new FDMTransformer().getTransformer(),
        // Future -> xdp: XDPTransformer.getTransformer(),
    }
}


class UniversalEditor {
    constructor () {
        this.transformer = null;
    }

    setTransformer(schemaType) {
        this.transformer = FormatRegistry.universalEditor[schemaType];
    }

    transform(data) {
        return this.transformer(data)
    }

    fetch() {
        return {
            id: "",
            label: "",
        }
    }
    update() {

    }

}
const ue = new UniversalEditor()
ue.setTransformer('fdm')
export default ue;