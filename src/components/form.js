import { deepMerge, isFunction, isEmpty, isString, isObject, isBoolean, cloneDeep } from "@/utils";
import { renderNode } from "@/utils/vnode";
import Parse from "@/utils/parse";
import { Form, Emitter, Screen } from "@/mixins";
import { __inst } from "@/store";

export default {
	name: "cl-form",
	componentName: "ClForm",
	mixins: [Emitter, Screen, Form],
	props: {
		// Bind value
		value: {
			type: Object,
			default: () => {
				return {};
			}
		}
	},
	provide() {
		return {
			form: this.form
		};
	},
	data() {
		return {
			visible: false,
			saving: false,
			loading: false,
			form: {},
			conf: {
				title: "自定义表单",
				width: "50%",
				props: {
					size: "small",
					"label-width": "100px"
				},
				on: {
					open: null,
					submit: null,
					close: null
				},
				op: {
					hidden: false,
					saveButtonText: "保存",
					closeButtonText: "取消",
					buttons: ["close", "save"]
				},
				dialog: {
					props: {
						fullscreen: false,
						"close-on-click-modal": false,
						"append-to-body": true
					},
					hiddenControls: false,
					controls: ["fullscreen", "close"]
				},
				items: [],
				_data: {}
			},
			tabActive: null
		};
	},
	watch: {
		value: {
			immediate: true,
			deep: true,
			handler(val) {
				this.form = val;
			}
		},
		form: {
			immediate: true,
			handler(val) {
				this.$emit("input", val);
			}
		}
	},
	methods: {
		open(options = {}) {
			// Merge conf
			for (let i in this.conf) {
				switch (i) {
					case "items":
						this.conf.items = cloneDeep(options.items || []);
						break;
					case "title":
					case "width":
						this.conf[i] = options[i];
						break;
					default:
						deepMerge(this.conf[i], options[i]);
						break;
				}
			}

			// Show dialog
			this.visible = true;

			// Preset form
			if (options.form) {
				for (let i in options.form) {
					this.$set(this.form, i, options.form[i]);
				}
			}

			// Set form data by items
			this.conf.items.map((e) => {
				if (e.prop) {
					// Priority use form data
					this.$set(this.form, e.prop, this.form[e.prop] || cloneDeep(e.value));
				}
			});

			// Open callback
			const { open } = this.conf.on;

			if (open) {
				this.$nextTick(() => {
					open(this.form, {
						close: this.close,
						submit: this.submit,
						done: this.done
					});
				});
			}

			return this;
		},

		beforeClose() {
			if (this.conf.on.close) {
				this.conf.on.close(this.close);
			} else {
				this.close();
			}
		},

		close() {
			this.visible = false;
			this.clear();
			this.done();
		},

		onClosed() {
			this.tabActive = null;

			for (let i in this.form) {
				delete this.form[i];
			}
		},

		done() {
			this.saving = false;
		},

		clear() {
			this.clearValidate();
		},

		submit() {
			// Validate form
			this.$refs["form"].validate(async (valid) => {
				if (valid) {
					this.saving = true;

					// Hooks event
					const { submit } = this.conf.on;

					// Get mount variable
					const { $refs } = __inst;

					// Hooks by onSubmit
					if (isFunction(submit)) {
						let d = cloneDeep(this.form);

						// Filter hidden data
						this.conf.items.forEach((e) => {
							if (e._hidden) {
								delete d[e.prop];
							}
						});

						submit(d, {
							done: this.done,
							close: this.close,
							$refs
						});
					} else {
						console.error("Submit is not found");
					}
				}
			});
		},

		showLoading() {
			this.loading = true;
		},

		hiddenLoading() {
			this.loading = false;
		},

		collapseItem(item) {
			// Clear item validate
			this.clearValidate(item.prop)

			// Toggle
			if (item.collapse !== undefined) {
				item.collapse = !item.collapse;
			}
		},

		renderForm() {
			const { props, items } = this.conf;

			return (
				<el-form
					ref="form"
					class="cl-form"
					{...{
						props: {
							"label-position": this.isMobile ? "top" : "",
							disabled: this.saving,
							model: this.form,
							...props
						}
					}}>
					{/* el-form-item list */}
					<el-row gutter={10} v-loading={this.loading}>
						{items.map((e, i) => {
							if (e.type == "tabs") {
								return (
									<cl-form-tabs
										v-model={this.tabActive}
										{...{ props: { ...e.props } }}></cl-form-tabs>
								);
							}

							// Is hidden
							e._hidden = Parse("hidden", {
								value: e.hidden,
								scope: this.form,
								data: this.conf._data
							});

							// Is group
							e._group = (isEmpty(this.tabActive) || isEmpty(e.group)) ? true : e.group === this.tabActive;

							// Parse label
							if (isString(e.label)) {
								e._label = {
									text: e.label
								}
							} else if (isObject(e.label)) {
								e._label = e.label
							} else {
								e._label = {
									text: ''
								}
							}

							return (
								e._group &&
								!e._hidden && (
									<el-col
										key={`form-item-${i}`}
										{...{
											props: {
												key: i,
												span: 24,
												...e
											}
										}}>
										{e.component && (
											<el-form-item
												{...{
													props: {
														label: e._label.text,
														prop: e.prop,
														rules: e.rules,
														...e.props
													}
												}}>
												{/* Redefine label */}
												<template slot="label">
													<el-tooltip effect="dark" placement="top" content={e._label.tip} disabled={!e._label.tip}>
														<span>
															{e._label.text}
															{
																e._label.icon && <i class={e._label.icon}></i>
															}
														</span>
													</el-tooltip>
												</template>

												{/* Form item */}
												<div class="cl-form-item">
													{/* Component */}
													{["prepend", "component", "append"].map(
														(name) => {
															return (
																e[name] && (
																	<div
																		v-show={!e.collapse}
																		class={[
																			`cl-form-item__${name}`,
																			{
																				"is-flex": isEmpty(
																					e.flex
																				)
																					? true
																					: e.flex
																			}
																		]}
																	>
																		{renderNode(e[name], {
																			prop: e.prop,
																			scope: this.form,
																			$scopedSlots: this
																				.$scopedSlots
																		})}
																	</div>
																)
															);
														}
													)}
												</div>
												{/* Collapse button */}
												{
													isBoolean(e.collapse) &&
													<div
														class="cl-form-item__collapse"
														on-click={() => {
															this.collapseItem(e);
														}}>
														<el-divider content-position="center">
															{
																e.collapse
																	? (
																		<span>
																			点击展开，查看更多
																			<i class="el-icon-arrow-down"></i>
																		</span>
																	)
																	: (
																		<span>
																			点击收起，隐藏内容
																			<i class="el-icon-arrow-up"></i>
																		</span>
																	)
															}
														</el-divider>
													</div>
												}
											</el-form-item>
										)}
									</el-col>
								)
							);
						})}
					</el-row>
				</el-form>
			);
		},

		renderFooter() {
			const { hidden, buttons, saveButtonText, closeButtonText } = this.conf.op;
			const { size = "small" } = this.conf.props;

			return hidden
				? null
				: buttons.map((vnode) => {
					if (vnode == "save") {
						return (
							<el-button
								{...{
									props: {
										size,
										type: "success",
										disabled: this.loading,
										loading: this.saving
									},
									on: {
										click: () => {
											this.submit();
										}
									}
								}}>
								{saveButtonText}
							</el-button>
						);
					} else if (vnode == "close") {
						return (
							<el-button
								{...{
									props: {
										size
									},
									on: {
										click: () => {
											this.beforeClose();
										}
									}
								}}>
								{closeButtonText}
							</el-button>
						);
					} else {
						return renderNode(vnode, {
							scope: this.form,
							$scopedSlots: this.$scopedSlots
						});
					}
				});
		}
	},

	render() {
		const { title, width, dialog } = this.conf;

		return (
			<div class="cl-form">
				<cl-dialog
					title={title}
					width={width}
					visible={this.visible}
					{...{
						props: {
							...dialog,
							props: {
								...dialog.props,
								"before-close": this.beforeClose
							}
						},
						on: {
							"update:visible": (v) => (this.visible = v),
							"update:props:fullscreen": (v) => (dialog.props.fullscreen = v),
							closed: this.onClosed
						}
					}}>
					<div class="cl-form__container">{this.renderForm()}</div>
					<div class="cl-form__footer" slot="footer">
						{this.renderFooter()}
					</div>
				</cl-dialog>
			</div>
		);
	}
};
